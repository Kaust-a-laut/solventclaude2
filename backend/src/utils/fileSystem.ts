import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from './logger';

// Single source of truth for project root - resolves from this file's location
export const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export const validatePath = (targetPath: string) => {
  const normalized = path.resolve(PROJECT_ROOT, targetPath);
  // Use trailing separator to prevent prefix attacks (e.g. /root vs /root-evil)
  const rootWithSep = PROJECT_ROOT.endsWith(path.sep) ? PROJECT_ROOT : PROJECT_ROOT + path.sep;
  if (!normalized.startsWith(rootWithSep) && normalized !== PROJECT_ROOT) {
    throw new Error(`SECURITY ALERT: Path escape detected: ${targetPath}`);
  }
  return normalized;
};

export class AtomicFileSystem {
  /**
   * Writes data to a file atomically by first writing to a temp file
   * and then renaming it. This prevents data corruption on crashes.
   */
  static async writeJson(filePath: string, data: unknown) {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      await fs.rename(tempPath, filePath);
    } catch (error) {
      logger.error(`[AtomicFS] Failed to write JSON to ${filePath}`, error);
      try { await fs.unlink(tempPath); } catch (e) { logger.debug('[AtomicFS] Temp file cleanup failed', { path: tempPath }); }
      throw error;
    }
  }

  static async writeFile(filePath: string, content: string) {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tempPath, content);
      await fs.rename(tempPath, filePath);
    } catch (error) {
      logger.error(`[AtomicFS] Failed to write file to ${filePath}`, error);
      try { await fs.unlink(tempPath); } catch (e) { logger.debug('[AtomicFS] Temp file cleanup failed', { path: tempPath }); }
      throw error;
    }
  }
}
