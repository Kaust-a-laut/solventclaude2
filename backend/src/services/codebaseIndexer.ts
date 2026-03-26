import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { vectorService } from './vectorService';

interface FileWatcherConfig {
  rootPath: string;
  ignoredDirs: string[];
  extensions: string[];
  debounceMs: number;
  maxBatchSize: number;
}

export class CodebaseIndexer {
  private watcher: chokidar.FSWatcher | null = null;
  private pendingChanges: Map<string, { path: string; content: string; mtime: number }> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isIndexing = false;
  private config: FileWatcherConfig | null = null;
  private fileHashes: Map<string, string> = new Map();

  private readonly DEFAULT_CONFIG: FileWatcherConfig = {
    rootPath: process.cwd(),
    ignoredDirs: ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'generated_images', 'coverage'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.py', '.json'],
    debounceMs: 5000,
    maxBatchSize: 20
  };

  /**
   * Initialize and start watching the codebase
   */
  async start(config?: Partial<FileWatcherConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    
    logger.info('[CodebaseIndexer] Starting file watcher...');
    
    try {
      // Load existing file hashes for change detection
      await this.loadFileHashes();
      
      // Initial index if not already indexed
      await this.indexProject(this.config.rootPath);
      
      // Start watching
      this.startWatcher();
      
      logger.info('[CodebaseIndexer] File watcher started. Monitoring for changes...');
    } catch (error) {
      logger.error('[CodebaseIndexer] Failed to start file watcher', error);
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('[CodebaseIndexer] File watcher stopped.');
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Start the chokidar file watcher
   */
  private startWatcher() {
    if (!this.config) return;

    const ignorePatterns = this.config.ignoredDirs.map(d => `**/${d}/**`);
    
    this.watcher = chokidar.watch(this.config.rootPath, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileUnlink(filePath))
      .on('error', (error) => logger.error('[CodebaseIndexer] Watcher error', error));
  }

  /**
   * Handle file add/change events
   */
  private async handleFileChange(filePath: string, event: 'add' | 'change') {
    if (!this.config || !this.shouldIndexFile(filePath)) return;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = this.hashContent(content);
      const stats = await fs.stat(filePath);

      // Skip if content hasn't actually changed
      const relativePath = path.relative(this.config.rootPath, filePath);
      if (this.fileHashes.has(relativePath) && this.fileHashes.get(relativePath) === hash) {
        logger.debug(`[CodebaseIndexer] Skipping unchanged file: ${relativePath}`);
        return;
      }

      this.pendingChanges.set(relativePath, {
        path: filePath,
        content,
        mtime: stats.mtimeMs
      });

      this.fileHashes.set(relativePath, hash);

      // Debounce batch indexing
      this.scheduleIndexing();
    } catch (error) {
      logger.error(`[CodebaseIndexer] Failed to read changed file: ${filePath}`, error);
    }
  }

  /**
   * Handle file deletion
   */
  private async handleFileUnlink(filePath: string) {
    if (!this.config) return;

    const relativePath = path.relative(this.config.rootPath, filePath);
    
    // Remove from pending changes
    this.pendingChanges.delete(relativePath);
    
    // Remove from hash cache
    this.fileHashes.delete(relativePath);
    
    // Remove from vector index (by file path)
    try {
      await vectorService.deleteByFilePath(relativePath);
      logger.info(`[CodebaseIndexer] Removed deleted file from index: ${relativePath}`);
    } catch (error) {
      logger.error(`[CodebaseIndexer] Failed to remove deleted file: ${relativePath}`, error);
    }
  }

  /**
   * Schedule batch indexing with debounce
   */
  private scheduleIndexing() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges().catch(error => {
        logger.error('[CodebaseIndexer] Failed to process pending changes', error);
      });
    }, this.config?.debounceMs || 5000);
  }

  /**
   * Process all pending file changes
   */
  private async processPendingChanges() {
    if (this.pendingChanges.size === 0 || this.isIndexing) return;

    this.isIndexing = true;
    logger.info(`[CodebaseIndexer] Indexing ${this.pendingChanges.size} changed files...`);

    try {
      const entries: { text: string; metadata: any }[] = [];

      for (const [relativePath, fileData] of this.pendingChanges.entries()) {
        const chunks = this.chunkFile(fileData.content, fileData.path);
        entries.push(...chunks);

        // Process in batches to avoid memory issues
        if (entries.length >= (this.config?.maxBatchSize || 20)) {
          await this.addEntriesBatch(entries.splice(0, this.config?.maxBatchSize || 20));
        }
      }

      // Process remaining entries
      if (entries.length > 0) {
        await this.addEntriesBatch(entries);
      }

      logger.info(`[CodebaseIndexer] Incremental indexing complete. ${this.pendingChanges.size} files processed.`);
      this.pendingChanges.clear();
    } catch (error) {
      logger.error('[CodebaseIndexer] Incremental indexing failed', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Add a batch of entries to the vector index
   */
  private async addEntriesBatch(entries: { text: string; metadata: any }[]) {
    if (entries.length === 0) return;

    await vectorService.addEntriesBatch(entries);

    // Resolve semantic relationships for code files
    for (const entry of entries) {
      if (entry.metadata.type === 'code_block') {
        const links = this.findReferenceTargets(entry.text, entry.metadata.id);
        if (links.length > 0) {
          await vectorService.addLinks(entry.metadata.id, links);
        }
      }
    }
  }

  /**
   * Chunk a file into indexable pieces
   */
  private chunkFile(content: string, filePath: string): { text: string; metadata: any }[] {
    const maxChunkSize = 1200;
    const overlapSize = 200;
    const relativePath = path.relative(this.config!.rootPath, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isCodeFile = ['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext);

    const chunks: { text: string; metadata: any }[] = [];
    
    // Split at declaration boundaries for code files
    let blocks: string[];
    if (isCodeFile) {
      const declPattern = /\n(?=(?:export\s+)?(?:class|function|interface|const|let|var|type|enum)\s)/g;
      const declBlocks = content.split(declPattern).filter(b => b.trim().length > 0);
      blocks = declBlocks.length > 1 ? declBlocks : content.split(/\n\n+/);
    } else {
      blocks = content.split(/\n\n+/);
    }

    let currentChunk = '';

    for (const block of blocks) {
      if ((currentChunk + block).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk,
          metadata: {
            filePath: relativePath,
            type: 'code_block',
            tier: 'episodic',
            symbols: this.extractSymbols(currentChunk),
            fileModifiedAt: Date.now()
          }
        });
        // Keep overlap for context continuity
        currentChunk = currentChunk.slice(-overlapSize);
      }
      currentChunk += (currentChunk ? '\n\n' : '') + block;
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk,
        metadata: {
          filePath: relativePath,
          type: 'code_block',
          tier: 'episodic',
          symbols: this.extractSymbols(currentChunk),
          fileModifiedAt: Date.now()
        }
      });
    }

    return chunks;
  }

  /**
   * Extract symbols from code
   */
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
   * Find semantic relationships between code blocks
   */
  private findReferenceTargets(text: string, sourceId: string): { targetId: string; type: string }[] {
    const links: { targetId: string; type: string }[] = [];
    const symbolIndex = vectorService.getSymbolIndex();

    for (const [symbol, targetId] of symbolIndex.entries()) {
      if (targetId === sourceId) continue;

      // Match whole words only
      const symbolRegex = new RegExp(`\\b${symbol}\\b`);
      if (symbolRegex.test(text)) {
        // Check for dependency patterns
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

  /**
   * Check if a file should be indexed
   */
  private shouldIndexFile(filePath: string): boolean {
    if (!this.config) return false;

    const ext = path.extname(filePath).toLowerCase();
    return this.config.extensions.includes(ext);
  }

  /**
   * Simple hash function for content comparison
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Load file hashes from disk cache
   */
  private async loadFileHashes() {
    try {
      const cachePath = path.join(this.config!.rootPath, '.solvent_file_hashes.json');
      const data = await fs.readFile(cachePath, 'utf-8');
      this.fileHashes = new Map(JSON.parse(data));
      logger.info('[CodebaseIndexer] Loaded file hash cache');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn('[CodebaseIndexer] Failed to load file hash cache, starting fresh');
      }
      this.fileHashes = new Map();
    }
  }

  /**
   * Save file hashes to disk cache
   */
  private async saveFileHashes() {
    try {
      const cachePath = path.join(this.config!.rootPath, '.solvent_file_hashes.json');
      await fs.writeFile(cachePath, JSON.stringify(Array.from(this.fileHashes.entries())), 'utf-8');
    } catch (error) {
      logger.error('[CodebaseIndexer] Failed to save file hash cache', error);
    }
  }

  /**
   * Perform a full project index
   */
  async indexProject(rootPath: string) {
    logger.info(`[CodebaseIndexer] Performing full project index: ${rootPath}`);
    await vectorService.indexProject(rootPath);
    
    // Save file hashes after full index
    await this.saveFileHashes();
  }

  /**
   * Get indexing status
   */
  getStatus() {
    return {
      isWatching: this.watcher !== null,
      pendingChanges: this.pendingChanges.size,
      isIndexing: this.isIndexing,
      cachedFiles: this.fileHashes.size
    };
  }
}

export const codebaseIndexer = new CodebaseIndexer();
