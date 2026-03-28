import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupManager } from './backupManager';
import fs from 'fs/promises';
import path from 'path';

describe('BackupManager', () => {
  const testDir = path.resolve(__dirname, '../../../.solvent_test_backups');
  const testFile = path.resolve(__dirname, '../../../.solvent_test_memory.json');
  let backupManager: BackupManager;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, JSON.stringify({ test: 'data' }));
    backupManager = new BackupManager(testFile, testDir, 3);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm(testFile, { force: true });
  });

  it('should create a timestamped backup', async () => {
    await backupManager.createBackup();

    const files = await fs.readdir(testDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('should rotate backups keeping only maxBackups', async () => {
    for (let i = 0; i < 5; i++) {
      await backupManager.createBackup();
      await new Promise(r => setTimeout(r, 1100)); // Ensure different timestamps (1.1s)
    }

    const files = await fs.readdir(testDir);
    expect(files.length).toBe(3);
  }, 10000); // Increase timeout to 10 seconds

  it('should validate backup integrity with checksum', async () => {
    await backupManager.createBackup();

    const files = await fs.readdir(testDir);
    const backupPath = path.join(testDir, files[0]!);
    const isValid = await backupManager.validateBackup(backupPath);

    expect(isValid).toBe(true);
  });

  it('should detect corrupted backups', async () => {
    await backupManager.createBackup();

    const files = await fs.readdir(testDir);
    const backupPath = path.join(testDir, files[0]!);

    await fs.writeFile(backupPath, 'corrupted{{{');

    const isValid = await backupManager.validateBackup(backupPath);
    expect(isValid).toBe(false);
  });

  it('should restore from most recent valid backup', async () => {
    const originalData = { entries: [{ id: '1', data: 'original' }] };
    await fs.writeFile(testFile, JSON.stringify(originalData));
    await backupManager.createBackup();

    await fs.writeFile(testFile, 'corrupted');

    const restored = await backupManager.restoreFromBackup();
    expect(restored).toBe(true);

    const content = JSON.parse(await fs.readFile(testFile, 'utf-8'));
    expect(content).toEqual(originalData);
  });
});
