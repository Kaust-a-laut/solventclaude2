import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './useAppStore';

// Mock fetch
global.fetch = vi.fn();

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test — include sessions to prevent message accumulation across tests
    useAppStore.setState({
      messages: [],
      sessions: {},
      isProcessing: false,
    });
    vi.clearAllMocks();
  });

  it('should add a message', () => {
    const { addMessage } = useAppStore.getState();
    addMessage({ role: 'user', content: 'Hello' });
    expect(useAppStore.getState().messages).toHaveLength(1);
    expect(useAppStore.getState().messages[0].content).toBe('Hello');
  });

  it('should handle sendMessage success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'AI Response' }),
    });

    const { sendMessage } = useAppStore.getState();
    await sendMessage('Hello AI');

    const state = useAppStore.getState();
    expect(state.messages).toHaveLength(2); // User + Assistant
    expect(state.messages[1].content).toBe('AI Response');
    expect(state.isProcessing).toBe(false);
  });

  it('should handle sendMessage failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Service Unavailable' }),
    });

    const { sendMessage } = useAppStore.getState();
    await sendMessage('Hello AI');

    const state = useAppStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].content).toContain('Error: Service Unavailable');
  });
});
