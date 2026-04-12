import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './useAppStore';

// Mock fetchWithRetry so tests never hit getSecret() or the real network
vi.mock('../lib/api-client', () => ({
  fetchWithRetry: vi.fn(),
  getSecret: vi.fn().mockResolvedValue('test-secret'),
  APIError: class APIError extends Error {
    body: unknown;
    status?: number;
    constructor(message: string, status?: number, _statusText?: string, body?: unknown) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.body = body;
    }
  },
}));

import { fetchWithRetry } from '../lib/api-client';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state — include sessions to prevent message accumulation across tests
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
    (fetchWithRetry as ReturnType<typeof vi.fn>).mockResolvedValue({ response: 'AI Response' });

    const { sendMessage } = useAppStore.getState();
    await sendMessage('Hello AI');

    const state = useAppStore.getState();
    expect(state.messages).toHaveLength(2); // User + Assistant
    expect(state.messages[1].content).toBe('AI Response');
    expect(state.isProcessing).toBe(false);
  });

  it('should handle sendMessage failure', async () => {
    const err = Object.assign(new Error('Service Unavailable'), {
      body: { error: 'Service Unavailable' },
    });
    (fetchWithRetry as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    const { sendMessage } = useAppStore.getState();
    await sendMessage('Hello AI');

    const state = useAppStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].content).toContain('Error: Service Unavailable');
  });
});

describe('previewUrl / previewSnapshot store fields', () => {
  beforeEach(() => {
    useAppStore.setState({ previewUrl: null, previewSnapshot: null });
  });

  it('starts as null', () => {
    expect(useAppStore.getState().previewUrl).toBeNull();
    expect(useAppStore.getState().previewSnapshot).toBeNull();
  });

  it('setPreviewUrl stores and clears the URL', () => {
    useAppStore.getState().setPreviewUrl('http://localhost:3000');
    expect(useAppStore.getState().previewUrl).toBe('http://localhost:3000');
    useAppStore.getState().setPreviewUrl(null);
    expect(useAppStore.getState().previewUrl).toBeNull();
  });

  it('setPreviewSnapshot stores and clears HTML', () => {
    useAppStore.getState().setPreviewSnapshot('<html><body>hi</body></html>');
    expect(useAppStore.getState().previewSnapshot).toContain('<body>hi</body>');
    useAppStore.getState().setPreviewSnapshot(null);
    expect(useAppStore.getState().previewSnapshot).toBeNull();
  });
});
