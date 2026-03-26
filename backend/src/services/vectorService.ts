import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import fs from 'fs/promises';
import { statSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { CrystallizedMemory, CrystallizedRule, SuccessPattern, SupervisoryInsight } from '../types/memory';
import { AtomicFileSystem } from '../utils/fileSystem';
import { BackupManager } from '../utils/backupManager';
import { HNSWIndex } from '../utils/hnswIndex';
import { memoryMetrics } from '../utils/memoryMetrics';
import { OllamaService } from './ollamaService';

interface VectorEntry {
  id: string;
  vector: number[];
  metadata: any; 
}

export type MemoryTier = 'episodic' | 'crystallized' | 'meta-summary' | 'archived';

interface CachedEmbedding {
  vector: number[];
  lastAccess: number;
  dirty: boolean; // Flag for efficient persistence
}

export class VectorService {
  private genAI: GoogleGenerativeAI | null = null;
  private ollama: OllamaService | null = null;
  private dbPath: string;
  private embeddingCachePath: string;
  private memory: VectorEntry[] = [];
  private isIndexing: boolean = false;
  private embeddingCache: Map<string, CachedEmbedding> = new Map();
  private embeddingCacheLoaded: Promise<void>;
  private newEntriesSinceLastDream: number = 0;
  private readonly SATURATION_THRESHOLD = 200;
  private cacheWriteCounter: number = 0;
  private readonly CACHE_PERSIST_THRESHOLD = 100;
  private backupManager: BackupManager;
  private hnswIndex: HNSWIndex | null = null;
  private hnswIndexPath: string;
  private useHNSW: boolean = true;
  private saveCounter: number = 0;
  private readonly BACKUP_INTERVAL = 50;
  private hnswSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly HNSW_SAVE_DEBOUNCE_MS = 30_000;

  // LRU Cache Configuration
  private readonly MAX_CACHE_SIZE = config.MEMORY_CACHE_SIZE;

  // Secondary Indices
  public typeIndex: Map<string, Set<string>> = new Map();
  public tagIndex: Map<string, Set<string>> = new Map();
  public symbolIndex: Map<string, string> = new Map(); // symbol -> entryId

  constructor() {
    if (config.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    }
    // Initialize Ollama as fallback for embeddings
    this.ollama = new OllamaService();
    this.dbPath = path.resolve(__dirname, '../../../.solvent_memory.json');
    this.embeddingCachePath = path.resolve(__dirname, '../../../.solvent_embedding_cache.json');
    this.backupManager = new BackupManager(
      this.dbPath,
      path.resolve(__dirname, '../../../.solvent_backups'),
      5
    );
    this.hnswIndexPath = path.resolve(__dirname, '../../../.solvent_hnsw.bin');
    this.loadMemory();
    this.embeddingCacheLoaded = this.loadEmbeddingCache();
    this.initHNSWIndex();
  }

  private async initHNSWIndex() {
    try {
      this.hnswIndex = new HNSWIndex(768, config.MEMORY_MAX_ENTRIES + 500);

      // Try to load existing index
      try {
        await this.hnswIndex.load(this.hnswIndexPath);
        logger.info('[VectorService] Loaded existing HNSW index.');
      } catch {
        // No existing index, rebuild from memory once it's loaded
        // We wait for memory to be loaded in loadMemory()
      }
    } catch (e) {
      logger.warn('[VectorService] HNSW initialization failed, using brute force.', e);
      this.useHNSW = false;
    }
  }

  private async rebuildHNSWIndex() {
    if (!this.hnswIndex) return;

    logger.info('[VectorService] Rebuilding HNSW index from memory...');
    for (const entry of this.memory) {
      this.hnswIndex.add(entry.id, entry.vector);
    }

    try {
      await this.hnswIndex.save(this.hnswIndexPath);
      logger.info(`[VectorService] HNSW index rebuilt with ${this.memory.length} entries.`);
    } catch (e) {
      logger.error('[VectorService] Failed to save rebuilt HNSW index', e);
    }
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      throw new Error('Gemini API Key missing for Vector Service.');
    }
    return this.genAI;
  }

  private async loadMemory() {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      this.memory = JSON.parse(data);
      this.rebuildIndices();
      logger.info(`Loaded ${this.memory.length} vectors from memory and rebuilt indices.`);
      
      // If HNSW index is empty but we have memory, rebuild it
      if (this.useHNSW && this.hnswIndex && this.hnswIndex.size() === 0 && this.memory.length > 0) {
        this.rebuildHNSWIndex();
      }
    } catch (e: any) {
      logger.error(`[VectorService] Failed to load memory: ${e.message}`);

      // Attempt recovery from backup
      const recovered = await this.attemptRecovery();
      if (!recovered) {
        logger.warn('[VectorService] Starting with empty memory.');
        this.memory = [];
      }
    }
  }

  async attemptRecovery(): Promise<boolean> {
    logger.warn('[VectorService] Attempting recovery from backup...');
    const restored = await this.backupManager.restoreFromBackup();
    if (restored) {
      try {
        const data = await fs.readFile(this.dbPath, 'utf-8');
        this.memory = JSON.parse(data);
        this.rebuildIndices();
        logger.info(`[VectorService] Recovery successful. Loaded ${this.memory.length} vectors.`);
        if (this.useHNSW) this.rebuildHNSWIndex();
        return true;
      } catch (e) {
        logger.error('[VectorService] Failed to load restored data');
        return false;
      }
    }
    return false;
  }

  async loadEmbeddingCache() {
    try {
      const data = await fs.readFile(this.embeddingCachePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate structure
      if (!Array.isArray(parsed)) {
        logger.warn('[VectorService] Embedding cache file has invalid format, starting fresh.');
        return;
      }

      this.embeddingCache.clear();
      let loadedCount = 0;
      for (const entry of parsed) {
        // Validate each entry has required fields
        if (entry && typeof entry.text === 'string' && Array.isArray(entry.vector)) {
          // Mark loaded entries as clean (not dirty) since they match disk state
          this.embeddingCache.set(entry.text, {
            vector: entry.vector,
            lastAccess: entry.lastAccess || Date.now(),
            dirty: false
          });
          loadedCount++;
        }
      }
      logger.info(`[VectorService] Loaded ${loadedCount} cached embeddings from disk.`);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        // File doesn't exist yet, that's fine
        logger.debug('[VectorService] No embedding cache file found, starting fresh.');
      } else {
        // JSON parse error or other issue
        logger.warn(`[VectorService] Failed to load embedding cache: ${e.message}. Starting fresh.`);
      }
    }
  }

  async persistEmbeddingCache() {
    try {
      // Dirty-flag approach: Only persist entries that have been modified since last persist
      const dirtyEntries = Array.from(this.embeddingCache.entries())
        .filter(([_, data]) => data.dirty)
        .map(([text, { vector, lastAccess }]) => ({
          text,
          vector,
          lastAccess
        }));
      
      if (dirtyEntries.length === 0) {
        logger.debug('[VectorService] No dirty entries to persist.');
        return;
      }
      
      await AtomicFileSystem.writeJson(this.embeddingCachePath, dirtyEntries);
      logger.info(`[VectorService] Persisted ${dirtyEntries.length} dirty embeddings to cache file.`);
      
      // Mark all entries as clean after successful persist
      for (const [text] of this.embeddingCache.entries()) {
        const entry = this.embeddingCache.get(text);
        if (entry) entry.dirty = false;
      }
    } catch (error) {
      logger.error('[VectorService] Failed to persist embedding cache', error);
    }
  }

  private rebuildIndices() {
    this.typeIndex.clear();
    this.tagIndex.clear();
    this.symbolIndex.clear();
    for (const entry of this.memory) {
      this.addToIndices(entry);
    }
  }

  private addToIndices(entry: VectorEntry) {
    // Type Index
    const type = entry.metadata.type;
    if (type) {
      if (!this.typeIndex.has(type)) this.typeIndex.set(type, new Set());
      this.typeIndex.get(type)!.add(entry.id);
    }

    // Tag Index
    const tags = entry.metadata.tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
        this.tagIndex.get(tag)!.add(entry.id);
      }
    }

    // Symbol Index
    const symbols = entry.metadata.symbols;
    if (Array.isArray(symbols)) {
      for (const symbol of symbols) {
        this.symbolIndex.set(symbol, entry.id);
      }
    }
  }

  private removeFromIndices(id: string) {
    const entry = this.memory.find(m => m.id === id);
    if (!entry) return;

    if (this.hnswIndex && this.useHNSW) {
      this.hnswIndex.markDeleted(id);
    }

    if (entry.metadata.type) {
      this.typeIndex.get(entry.metadata.type)?.delete(id);
    }

    if (Array.isArray(entry.metadata.tags)) {
      for (const tag of entry.metadata.tags) {
        this.tagIndex.get(tag)?.delete(id);
      }
    }

    if (Array.isArray(entry.metadata.symbols)) {
      for (const symbol of entry.metadata.symbols) {
        if (this.symbolIndex.get(symbol) === id) {
          this.symbolIndex.delete(symbol);
        }
      }
    }
  }

  private extractSymbols(text: string): string[] {
    const symbols: string[] = [];
    // Class definitions
    const classMatches = text.matchAll(/class\s+([a-zA-Z0-9_]+)/g);
    for (const match of classMatches) symbols.push(match[1]);

    // Interface definitions
    const interfaceMatches = text.matchAll(/interface\s+([a-zA-Z0-9_]+)/g);
    for (const match of interfaceMatches) symbols.push(match[1]);

    // Function definitions
    const functionMatches = text.matchAll(/function\s+([a-zA-Z0-9_]+)/g);
    for (const match of functionMatches) symbols.push(match[1]);

    // Exported constants/vars
    const constMatches = text.matchAll(/export\s+(const|let|var)\s+([a-zA-Z0-9_]+)/g);
    for (const match of constMatches) symbols.push(match[2]);

    return [...new Set(symbols)];
  }

  /**
   * Delete entries by file path (for incremental indexing)
   */
  async deleteByFilePath(filePath: string) {
    const entriesToDelete = this.memory.filter(e => e.metadata.filePath === filePath);
    for (const entry of entriesToDelete) {
      this.removeFromIndices(entry.id);
    }
    this.memory = this.memory.filter(e => e.metadata.filePath !== filePath);
    await this.saveMemory();
    return entriesToDelete.length;
  }

  /**
   * Add links to an existing entry
   */
  async addLinks(entryId: string, links: Array<{ targetId: string; type: string }>) {
    const entry = this.memory.find(e => e.id === entryId);
    if (!entry) return false;

    if (!entry.metadata.links) {
      entry.metadata.links = [];
    }
    entry.metadata.links.push(...links);
    await this.saveMemory();
    return true;
  }

  /**
   * Get the symbol index for external use
   */
  getSymbolIndex(): Map<string, string> {
    return this.symbolIndex;
  }

  private async saveMemory() {
    try {
      const MAX_ENTRIES = config.MEMORY_MAX_ENTRIES;

      if (this.memory.length > MAX_ENTRIES) {
        // Smart Eviction: Protect Anchors and Meta-Summaries
        const critical = this.memory.filter(m =>
          m.metadata.tier === 'meta-summary' ||
          m.metadata.isAnchor === true ||
          m.metadata.confidence === 'HIGH'
        );
        const disposable = this.memory.filter(m =>
          m.metadata.tier !== 'meta-summary' &&
          m.metadata.isAnchor !== true &&
          m.metadata.confidence !== 'HIGH'
        );

        if (critical.length >= MAX_ENTRIES) {
           this.memory = critical.slice(-MAX_ENTRIES);
        } else {
           const slotsLeft = MAX_ENTRIES - critical.length;
           const keptDisposable = disposable.slice(-slotsLeft);
           this.memory = [...critical, ...keptDisposable];
        }
        this.rebuildIndices();
      }

      await AtomicFileSystem.writeJson(this.dbPath, this.memory);
      this.updateMetrics();

      // Periodic backup
      this.saveCounter++;
      if (this.saveCounter >= this.BACKUP_INTERVAL) {
        this.saveCounter = 0;
        this.backupManager.createBackup().catch(e =>
          logger.error('[VectorService] Backup creation failed', e)
        );
      }

      // Debounced HNSW index persistence
      if (this.hnswIndex && this.useHNSW) {
        this.scheduleHnswSave();
      }
    } catch (error) {
      logger.error('Failed to save vector memory', error);
    }
  }

  // --- TYPED STORAGE METHODS ---

  async saveRule(rule: any) {
    const entry = {
      ...rule,
      tier: 'crystallized' as MemoryTier,
      isAnchor: true,
      importance: 5,
      type: 'permanent_rule',
      id: `rule_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return this.addEntry(rule.ruleText, entry);
  }

  async savePattern(pattern: any) {
    const entry = {
      ...pattern,
      tier: 'crystallized' as MemoryTier,
      type: 'solution_pattern',
      id: `pattern_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return this.addEntry(`${pattern.problemDomain}\n${pattern.solutionCode}`, entry);
  }

  async saveInsight(insight: any) {
    const entry = {
      ...insight,
      tier: 'crystallized' as MemoryTier,
      isAnchor: true,
      type: 'architectural_decision',
      id: `insight_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return this.addEntry(`${insight.decision}\n${insight.rationale}`, entry);
  }

  // --- CORE METHODS ---

  /**
   * Get embedding with fallback chain: Gemini → Ollama → zero vector
   */
  async getEmbedding(text: string): Promise<number[]> {
    await this.embeddingCacheLoaded; // Ensure cache is loaded
    if (!text || text.trim().length === 0) return new Array(768).fill(0);

    const cached = this.embeddingCache.get(text);
    if (cached?.vector) {
      cached.lastAccess = Date.now();
      memoryMetrics.recordCacheHit();
      return cached.vector;
    }

    // Handle case where cache entry exists but vector is missing
    if (cached) {
      this.embeddingCache.delete(text);
    }

    // Try Gemini first
    try {
      const genAI = this.getGenAI();
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      const values = result.embedding.values;

      memoryMetrics.recordCacheMiss();
      this.cacheEmbedding(text, values);

      return values;
    } catch (err: unknown) {
      logger.warn('[VectorService] Gemini embedding failed, trying Ollama fallback:', err instanceof Error ? err.message : String(err));
    }

    // Fallback to Ollama
    try {
      const values = await this.ollama!.embed(text);
      memoryMetrics.recordCacheMiss();
      this.cacheEmbedding(text, values);
      return values;
    } catch (err: unknown) {
      logger.warn('[VectorService] Ollama embedding failed, using zero vector:', err instanceof Error ? err.message : String(err));
    }

    // Last resort: zero vector
    logger.warn('[VectorService] All embedding sources failed, using zero vector');
    return new Array(768).fill(0);
  }

  async batchGetEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    texts.forEach((text, i) => {
      if (!text || text.trim().length === 0) {
        results[i] = new Array(768).fill(0);
      } else {
        const cached = this.embeddingCache.get(text);
        if (cached) {
          cached.lastAccess = Date.now();
          results[i] = cached.vector;
        } else {
          missingIndices.push(i);
          missingTexts.push(text);
        }
      }
    });

    if (missingTexts.length > 0) {
      // Try Gemini batch first
      try {
        const genAI = this.getGenAI();
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

        // Google SDK batchEmbedContents
        const batchSize = 100; // API limit usually
        for (let i = 0; i < missingTexts.length; i += batchSize) {
          const chunk = missingTexts.slice(i, i + batchSize);
          const response = await model.batchEmbedContents({
            requests: chunk.map(t => ({ content: { role: 'user', parts: [{ text: t }] } }))
          });

          response.embeddings.forEach((emb, j) => {
            const originalIndex = missingIndices[i + j];
            results[originalIndex] = emb.values;
            this.cacheEmbedding(chunk[j], emb.values);
          });
        }
      } catch (err: unknown) {
        logger.warn('[VectorService] Gemini batch embedding failed, falling back to Ollama:', err instanceof Error ? err.message : String(err));

        // Fallback: Process remaining with Ollama individually
        for (let i = 0; i < missingTexts.length; i++) {
          const originalIndex = missingIndices[i];
          if (!results[originalIndex]) {
            try {
              const values = await this.ollama!.embed(missingTexts[i]);
              results[originalIndex] = values;
              this.cacheEmbedding(missingTexts[i], values);
            } catch (ollamaErr: unknown) {
              logger.warn('[VectorService] Ollama embedding failed for batch item, using zero vector:', ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr));
              results[originalIndex] = new Array(768).fill(0);
            }
          }
        }
      }
    }

    return results;
  }

  private cacheEmbedding(text: string, vector: number[]) {
    // LRU Eviction: Remove least recently accessed entry when at capacity
    if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, val] of this.embeddingCache.entries()) {
        if (val.lastAccess < oldestTime) {
          oldestTime = val.lastAccess;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
        logger.debug(`[VectorService] LRU eviction: ${oldestKey}`);
      }
    }
    
    this.embeddingCache.set(text, { vector, lastAccess: Date.now(), dirty: true });
    memoryMetrics.updateCacheSize(this.embeddingCache.size);

    // Periodic persistence using dirty-flag approach
    this.cacheWriteCounter++;
    if (this.cacheWriteCounter >= this.CACHE_PERSIST_THRESHOLD) {
      this.cacheWriteCounter = 0;
      this.persistEmbeddingCache().catch(e => logger.error('[VectorService] Cache persist failed', e));
    }
  }

  async addEntry(text: string, metadata: any) {
    if (!text) return;
    const vector = await this.getEmbedding(text);
    
    // Normalize links if present
    let normalizedLinks = metadata.links;
    if (Array.isArray(metadata.links)) {
      normalizedLinks = metadata.links.map((link: any) => 
        typeof link === 'string' ? { targetId: link, type: 'references' } : link
      );
    }

    const entry: VectorEntry = {
      id: metadata.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
      vector,
      metadata: { 
        ...metadata, 
        text, 
        tier: metadata.tier || 'episodic',
        createdAt: metadata.createdAt || new Date().toISOString(),
        status: metadata.status || 'active',
        links: normalizedLinks
      }
    };

    this.memory.push(entry);
    this.addToIndices(entry);
    if (this.hnswIndex && this.useHNSW) {
      this.hnswIndex.add(entry.id, entry.vector);
    }
    this.newEntriesSinceLastDream++;

    if (this.newEntriesSinceLastDream >= this.SATURATION_THRESHOLD) {
      this.triggerAmnesiaCycle();
    }

    await this.saveMemory();
    return entry.id;
  }

  async addEntriesBatch(entries: { text: string, metadata: any }[]) {
    if (entries.length === 0) return [];

    const embeddings = await this.batchGetEmbeddings(entries.map(e => e.text));
    const ids: string[] = [];

    entries.forEach((e, i) => {
      // Normalize links if present
      let normalizedLinks = e.metadata.links;
      if (Array.isArray(e.metadata.links)) {
        normalizedLinks = e.metadata.links.map((link: any) => 
          typeof link === 'string' ? { targetId: link, type: 'references' } : link
        );
      }

      const entry: VectorEntry = {
        id: e.metadata.id || Date.now().toString() + Math.random().toString(36).substr(2, 5) + `_${i}`,
        vector: embeddings[i],
        metadata: {
          ...e.metadata,
          text: e.text,
          tier: e.metadata.tier || 'episodic',
          createdAt: e.metadata.createdAt || new Date().toISOString(),
          status: e.metadata.status || 'active',
          links: normalizedLinks
        }
      };
      this.memory.push(entry);
      this.addToIndices(entry);
      if (this.hnswIndex && this.useHNSW) {
        this.hnswIndex.add(entry.id, entry.vector);
      }
      ids.push(entry.id);
    });

    this.newEntriesSinceLastDream += entries.length;
    if (this.newEntriesSinceLastDream >= this.SATURATION_THRESHOLD) {
      this.triggerAmnesiaCycle();
    }

        await this.saveMemory();

        return ids;

      }

    

      async indexProject(rootPath: string) {

        if (this.isIndexing) {

          logger.warn('Indexing already in progress.');

          return;

        }

        this.isIndexing = true;

        logger.info(`Starting project indexing: ${rootPath}`);

        

        try {

          const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'generated_images'];

          const extensions = ['.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.py', '.json'];

          const pendingEntries: { text: string, metadata: any }[] = [];

    

          const scan = async (dir: string) => {

            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {

              const fullPath = path.join(dir, entry.name);

              if (entry.isDirectory()) {

                if (!ignoredDirs.includes(entry.name)) {

                  await scan(fullPath);

                }

              } else {

                const ext = path.extname(entry.name).toLowerCase();

                if (extensions.includes(ext)) {

                  const content = await fs.readFile(fullPath, 'utf-8');

                  if (content.trim().length > 10) {

                    // Collect chunks for batching

                    const chunks = this.chunkFile(content, fullPath);

                    pendingEntries.push(...chunks);

                    

                    // Process in batches of 20 to avoid memory/API limits

                    if (pendingEntries.length >= 20) {

                      await this.addEntriesBatch(pendingEntries.splice(0, 20));

                    }

                  }

                }

              }

            }

          };

    

                    await scan(rootPath);

    

                    

    

                    // Final flush

    

                    if (pendingEntries.length > 0) {

    

                      const addedIds = await this.addEntriesBatch(pendingEntries);

    

                      

    

                      // Second Pass: Resolve links for the newly added entries

    

                      logger.info('[VectorService] Resolving semantic relationships...');

    

                      for (const id of addedIds) {

    

                        const entry = this.memory.find(m => m.id === id);

    

                        if (entry && entry.metadata.type === 'code_block') {

    

                          const links = this.findReferenceTargets(entry.metadata.text, id);

    

                          if (links.length > 0) {

    

                            entry.metadata.links = links;

    

                          }

    

                        }

    

                      }

    

                    }

    

                    

    

                    logger.info('Project indexing completed.');

    

                  } catch (error) {

    

                    logger.error('Error during project indexing', error);

    

                  } finally {

    

                    this.isIndexing = false;

    

                  }

    

                }

    

          

    

                private findReferenceTargets(text: string, sourceId: string): { targetId: string, type: string }[] {

    

                  const links: { targetId: string, type: string }[] = [];

    

                  

    

                  for (const [symbol, targetId] of this.symbolIndex.entries()) {

    

                    // Avoid self-references

    

                    if (targetId === sourceId) continue;

    

          

    

                    // match whole words only

    

                    const symbolRegex = new RegExp(`\\b${symbol}\\b`);

    

                    if (symbolRegex.test(text)) {

    

                      // Rudimentary check for 'implements' or 'extends'

    

                      const depRegex = new RegExp(`(extends|implements|new|import|from)\\s+${symbol}\\b`);

    

                      if (depRegex.test(text)) {

    

                        links.push({ targetId, type: 'depends_on' });

    

                      } else {

    

                        links.push({ targetId, type: 'references' });

    

                      }

    

                    }

    

                  }

    

          

    

                  return links;

    

                }

    

          

    

      private chunkFile(content: string, filePath: string): { text: string, metadata: any }[] {
        const maxChunkSize = 1200;
        const overlapSize = 200;
        const relativePath = path.relative(process.cwd(), filePath);
        const ext = path.extname(filePath).toLowerCase();
        const isCodeFile = ['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext);

        // Get file modification time for stale detection
        let fileModifiedAt: number | undefined;
        try {
          fileModifiedAt = statSync(filePath).mtimeMs;
        } catch { /* ignore */ }

        // For code files, try to split at declaration boundaries first
        let blocks: string[];
        if (isCodeFile) {
          // Split at top-level declarations (class, function, export, interface)
          const declPattern = /\n(?=(?:export\s+)?(?:class|function|interface|const|let|var|type|enum)\s)/g;
          const declBlocks = content.split(declPattern).filter(b => b.trim().length > 0);
          // Use declaration-based splitting if it produces reasonable chunks
          blocks = declBlocks.length > 1 ? declBlocks : content.split(/\n\n+/);
        } else {
          blocks = content.split(/\n\n+/);
        }

        const chunks: { text: string, metadata: any }[] = [];
        let currentChunk = "";

        for (const block of blocks) {
          if ((currentChunk + block).length > maxChunkSize && currentChunk.length > 0) {
            chunks.push({
              text: currentChunk,
              metadata: {
                filePath: relativePath,
                type: 'code_block',
                tier: 'episodic',
                symbols: this.extractSymbols(currentChunk),
                fileModifiedAt
              }
            });
            // Keep overlap from end of current chunk for context continuity
            currentChunk = currentChunk.slice(-overlapSize);
          }
          currentChunk += (currentChunk ? "\n\n" : "") + block;
        }

        if (currentChunk.trim().length > 0) {
          chunks.push({
            text: currentChunk,
            metadata: {
              filePath: relativePath,
              type: 'code_block',
              tier: 'episodic',
              symbols: this.extractSymbols(currentChunk),
              fileModifiedAt
            }
          });
        }

        return chunks;
      }

    

      private triggerAmnesiaCycle() {
        this.newEntriesSinceLastDream = 0;
        // Use task service to schedule maintenance instead of running inline
        import('./taskService').then(({ taskService }) => {
          taskService.scheduleMaintenance().catch((e: any) =>
            logger.error('[VectorService] Maintenance scheduling failed', e)
          );
        }).catch((e: any) =>
          logger.error('[VectorService] Failed to import taskService', e)
        );
      }

    async updateEntry(id: string, updates: any) {
      const index = this.memory.findIndex(m => m.id === id);
      if (index === -1) return false;
  
      const oldEntry = { ...this.memory[index] };
      this.removeFromIndices(id);

      this.memory[index].metadata = {
        ...this.memory[index].metadata,
        ...updates
      };

      this.addToIndices(this.memory[index]);
      await this.saveMemory();
      return true;
    }
  
    async deprecateEntry(id: string, reason: string) {
      const index = this.memory.findIndex(m => m.id === id);
      if (index === -1) return false;
  
      this.memory[index].metadata = {
        ...this.memory[index].metadata,
        status: 'deprecated',
        deprecationReason: reason,
        deprecatedAt: new Date().toISOString()
      };
      
      logger.info(`[Gardening] Deprecated entry ${id}. Reason: ${reason}`);
          await this.saveMemory();
          return true;
        }
      
        async searchFast(query: string, limit: number = 5): Promise<(VectorEntry & { score: number })[]> {
          if (!this.hnswIndex || !this.useHNSW) {
            return this.search(query, limit);
          }
      
          const queryVector = await this.getEmbedding(query);
          const results = this.hnswIndex.search(queryVector, limit * 2);
      
          // Map back to full entries and apply filters
          const entries: (VectorEntry & { score: number })[] = [];
          for (const { id, distance } of results) {
            const entry = this.memory.find(m => m.id === id);
            if (entry && entry.metadata.status !== 'deprecated') {
              entries.push({ ...entry, score: 1 - distance }); // Convert distance to similarity
            }
          }
      
          return entries.slice(0, limit);
        }
      
          async search(query: string, limit: number = 5, filter?: { type?: string, tier?: MemoryTier, tags?: string[], includeDeprecated?: boolean }) {
      
            const startTime = Date.now();
      
            try {
      
              const queryVector = await this.getEmbedding(query);
      
              let candidates: VectorEntry[] = [];
      
        

      // Use indices if filter is specific enough
      if (filter?.type && this.typeIndex.has(filter.type)) {
        const ids = this.typeIndex.get(filter.type)!;
        candidates = this.memory.filter(m => ids.has(m.id));
      } else if (filter?.tags && filter.tags.length > 0) {
        // Find intersection or union of tags. Using union for broader recall.
        const candidateIds = new Set<string>();
        for (const tag of filter.tags) {
          if (this.tagIndex.has(tag)) {
            this.tagIndex.get(tag)!.forEach(id => candidateIds.add(id));
          }
        }
        candidates = this.memory.filter(m => candidateIds.has(m.id));
      } else {
        candidates = this.memory;
      }

      if (!filter?.includeDeprecated) {
        candidates = candidates.filter(m => m.metadata.status !== 'deprecated');
      }

      if (filter) {
        if (filter.type && candidates.length === this.memory.length) {
            candidates = candidates.filter(m => m.metadata.type === filter.type);
        }
        if (filter.tier) candidates = candidates.filter(m => m.metadata.tier === filter.tier);
        if (filter.tags && filter.tags.length > 0 && candidates.length === this.memory.length) {
          candidates = candidates.filter(m => 
            m.metadata.tags && filter.tags!.some(t => m.metadata.tags.includes(t))
          );
        }
      }

      const DECAY_LAMBDA = 0.05; // Relevance halves every ~14 days



      const results = candidates.map(entry => {

        const similarity = this.cosineSimilarity(queryVector, entry.vector);

        

        // --- TEMPORAL DECAY VS ANCHOR FORMULA ---

        const createdAt = new Date(entry.metadata.createdAt || Date.now());

        const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        

        const isAnchor = entry.metadata.isAnchor === true || entry.metadata.tier === 'meta-summary';

        const decay = isAnchor ? 1.0 : Math.exp(-DECAY_LAMBDA * ageInDays);

        const boost = isAnchor ? 0.3 : 0;

        

        const score = (similarity * decay) + boost;



        return { ...entry, score };

            })

                  .sort((a, b) => b.score - a.score)

                  .slice(0, limit);

            

                  // --- GRAPH-AUGMENTED RETRIEVAL (One-hop expansion) ---

                  const expandedResults = [...results];

                  for (const entry of results) {

                    if (entry.metadata.links && Array.isArray(entry.metadata.links)) {

                      for (const link of entry.metadata.links) {

                        // Only add if not already in results

                        if (!expandedResults.find(r => r.id === link.targetId)) {

                          const targetEntry = this.memory.find(m => m.id === link.targetId);

                          if (targetEntry) {

                            // Add with slightly lower score than its parent

                            expandedResults.push({ ...targetEntry, score: entry.score * 0.8 });

                          }

                        }

                      }

                    }

                  }

            

                  const finalResults = expandedResults.sort((a, b) => b.score - a.score).slice(0, limit + 2); // Allow small over-retrieval for context

            

                  const latency = Date.now() - startTime;

                  memoryMetrics.recordRetrieval(latency, candidates.length, finalResults.length);

            

                  return finalResults;

                } catch (error) {

            

      

      logger.error('Vector search failed', error);

      return [];

    }

  }

  async findRelated(id: string, limit: number = 3) {
    const target = this.memory.find(m => m.id === id);
    if (!target) return [];

    return this.memory
      .filter(m => m.id !== id)
      .map(entry => ({
        ...entry,
        score: this.cosineSimilarity(target.vector, entry.vector)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getRecentEntries(limit: number = 50) {
    return this.memory.slice(-limit);
  }

  getEntriesByIds(ids: string[]) {
    // Filter to only return entries that exist and filter out any undefined results
    return this.memory
      .filter((m): m is VectorEntry => m !== undefined && ids.includes(m.id))
      .filter(Boolean);
  }

  getMemoryInternal() {
    return this.memory;
  }

  private updateMetrics() {
    const byTier: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const entry of this.memory) {
      const tier = entry.metadata.tier || 'unknown';
      const type = entry.metadata.type || 'unknown';
      byTier[tier] = (byTier[tier] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
    }

    memoryMetrics.updateMemoryStats(
      this.memory.length,
      config.MEMORY_MAX_ENTRIES,
      byTier,
      byType
    );
  }

  /**
   * Get total number of entries in memory (used by BM25 to detect changes).
   */
  getMemorySize(): number {
    return this.memory.length;
  }

  /**
   * Get all entries as id+text pairs (used to build BM25 index).
   */
  getAllTexts(): Array<{ id: string; text: string }> {
    return this.memory
      .filter(e => e.metadata.status !== 'deprecated' && e.metadata.text)
      .map(e => ({ id: e.id, text: e.metadata.text }));
  }

  /**
   * Get a single entry by ID.
   */
  getEntryById(id: string): (VectorEntry & { score: number }) | null {
    const entry = this.memory.find(e => e.id === id);
    if (!entry || entry.metadata.status === 'deprecated') return null;
    return { ...entry, score: 0 };
  }

  /**
   * Record that entries were retrieved — increments retrievalCount for reinforcement.
   */
  async recordRetrieval(ids: string[]): Promise<void> {
    let changed = false;
    for (const id of ids) {
      const entry = this.memory.find(e => e.id === id);
      if (entry) {
        entry.metadata.retrievalCount = (entry.metadata.retrievalCount || 0) + 1;
        changed = true;
      }
    }
    if (changed) {
      // Batch save — piggyback on periodic save cycle rather than saving every retrieval
      this.saveCounter++;
      if (this.saveCounter % 10 === 0) {
        await this.saveMemory();
      }
    }
  }

  private scheduleHnswSave() {
    if (this.hnswSaveTimer) return;
    this.hnswSaveTimer = setTimeout(() => {
      this.hnswSaveTimer = null;
      if (this.hnswIndex) {
        this.hnswIndex.save(this.hnswIndexPath).catch(e =>
          logger.error('[VectorService] HNSW save failed', e)
        );
      }
    }, this.HNSW_SAVE_DEBOUNCE_MS);
  }

  async shutdown() {
    if (this.hnswSaveTimer) {
      clearTimeout(this.hnswSaveTimer);
      this.hnswSaveTimer = null;
    }
    if (this.hnswIndex && this.useHNSW) {
      await this.hnswIndex.save(this.hnswIndexPath);
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    if (denom === 0) return 0;
    return dotProduct / denom;
  }
}

export const vectorService = new VectorService();