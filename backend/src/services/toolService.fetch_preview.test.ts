import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

describe('toolService fetch_preview_source', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns html content for a valid URL', async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: '<html><body><h1>Hello</h1></body></html>',
    });

    const { toolService } = await import('./toolService');
    const result = await toolService.executeTool('fetch_preview_source', { url: 'http://localhost:3000' }) as Record<string, unknown>;
    expect(result.html).toContain('<h1>Hello</h1>');
    expect(result.url).toBe('http://localhost:3000');
  });

  it('returns error object when fetch fails', async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    const { toolService } = await import('./toolService');
    const result = await toolService.executeTool('fetch_preview_source', { url: 'http://localhost:3000' }) as Record<string, unknown>;
    expect(result.error).toContain('Connection refused');
  });

  it('rejects non-http URLs', async () => {
    const { toolService } = await import('./toolService');
    const result = await toolService.executeTool('fetch_preview_source', { url: 'file:///etc/passwd' }) as Record<string, unknown>;
    expect(result.error).toContain('Invalid URL');
  });
});
