import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationStorageService } from './conversationStorageService';
import fs from 'fs/promises';
import path from 'path';

describe('ConversationStorageService', () => {
  const testSessionDir = path.join(__dirname, '../../../.solvent_sessions_test');
  
  beforeEach(async () => {
    await fs.mkdir(testSessionDir, { recursive: true });
  });
  
  afterEach(async () => {
    await fs.rm(testSessionDir, { recursive: true, force: true });
  });
  
  it('should reject stale session updates', async () => {
    const service = new ConversationStorageService();
    // Override session path for testing
    (service as any).getSessionFilePath = (id: string) => 
      path.join(testSessionDir, `${id}.json`);
    
    const session1 = {
      id: 'test-1',
      mode: 'chat',
      title: 'Test',
      messages: [],
      createdAt: Date.now(),
      updatedAt: 1000,
      metadata: { modelsUsed: [], messageCount: 0, tokenEstimate: 0, tags: [] }
    };
    
    const session2 = { ...session1, updatedAt: 2000, messages: [{ id: '1', role: 'user' as const, content: 'new', timestamp: Date.now() }] };
    const staleSession = { ...session1, updatedAt: 500, messages: [{ id: '1', role: 'user' as const, content: 'old', timestamp: Date.now() }] };
    
    // Save newer version first
    await service.saveSession(session2);
    
    // Try to save stale version - should be rejected
    await service.saveSession(staleSession);
    
    // Verify newer version persisted
    const loaded = await service.loadSession('test-1');
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe('new');
  });
});
