import { HierarchicalNSW } from 'hnswlib-node';
import fs from 'fs/promises';
import { logger } from './logger';

export interface SearchResult {
  id: string;
  distance: number;
}

export class HNSWIndex {
  private index: HierarchicalNSW;
  private dimension: number;
  private maxElements: number;
  private idToLabel: Map<string, number> = new Map();
  private labelToId: Map<number, string> = new Map();
  private deletedLabels: Set<number> = new Set();
  private nextLabel: number = 0;

  constructor(dimension: number, maxElements: number) {
    this.dimension = dimension;
    this.maxElements = maxElements;
    this.index = new HierarchicalNSW('cosine', dimension);
    this.index.initIndex(maxElements, 16, 200, 100); // M=16, efConstruction=200, randomSeed=100
  }

  add(id: string, vector: number[]): void {
    if (this.idToLabel.has(id)) {
      // Update existing - mark old as deleted and add new
      this.markDeleted(id);
    }

    const label = this.nextLabel++;
    this.idToLabel.set(id, label);
    this.labelToId.set(label, id);

    try {
      this.index.addPoint(vector, label);
    } catch (e: any) {
      logger.error(`[HNSWIndex] Failed to add point ${id}. Vector length: ${vector.length}. Max elements: ${this.maxElements}. Error: ${e.message}`, e);
    }
  }

  search(query: number[], k: number): SearchResult[] {
    if (this.nextLabel === 0) return [];

    const actualK = Math.min(k + this.deletedLabels.size, this.nextLabel);

    try {
      const result = this.index.searchKnn(query, actualK);
      const neighbors = result.neighbors;
      const distances = result.distances;

      const results: SearchResult[] = [];
      for (let i = 0; i < neighbors.length && results.length < k; i++) {
        const label = neighbors[i]!;
        if (!this.deletedLabels.has(label)) {
          const id = this.labelToId.get(label);
          if (id) {
            results.push({ id, distance: distances[i] ?? Infinity });
          }
        }
      }
      return results;
    } catch (e) {
      logger.error('[HNSWIndex] Search failed', e);
      return [];
    }
  }

  markDeleted(id: string): void {
    const label = this.idToLabel.get(id);
    if (label !== undefined) {
      this.deletedLabels.add(label);
      this.idToLabel.delete(id);
    }
  }

  size(): number {
    return this.idToLabel.size;
  }

  async save(filePath: string): Promise<void> {
    try {
      this.index.writeIndexSync(filePath);

      // Save metadata separately
      const metadata = {
        idToLabel: Array.from(this.idToLabel.entries()),
        labelToId: Array.from(this.labelToId.entries()),
        deletedLabels: Array.from(this.deletedLabels),
        nextLabel: this.nextLabel
      };
      await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata));
      logger.info(`[HNSWIndex] Saved index to ${filePath}`);
    } catch (e) {
      logger.error('[HNSWIndex] Failed to save index', e);
      throw e;
    }
  }

  async load(filePath: string): Promise<void> {
    try {
      const newIndex = new HierarchicalNSW('cosine', this.dimension);
      newIndex.readIndexSync(filePath);
      this.index = newIndex;

      // Load metadata
      const metaContent = await fs.readFile(`${filePath}.meta.json`, 'utf-8');
      const metadata = JSON.parse(metaContent);

      this.idToLabel = new Map(metadata.idToLabel);
      this.labelToId = new Map(metadata.labelToId);
      this.deletedLabels = new Set(metadata.deletedLabels);
      this.nextLabel = metadata.nextLabel;

      logger.info(`[HNSWIndex] Loaded index from ${filePath} with ${this.idToLabel.size} entries`);
    } catch (e) {
      logger.error(`[HNSWIndex] Failed to load index from ${filePath}`, e);
      throw e;
    }
  }

  rebuild(): void {
    // Compact the index by rebuilding without deleted entries
    // Note: hnswlib doesn't expose vectors directly, so this requires external tracking
    logger.warn('[HNSWIndex] Rebuild requires external vector storage');
  }
}
