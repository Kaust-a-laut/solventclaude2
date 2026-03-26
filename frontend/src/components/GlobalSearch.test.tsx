import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSearch } from './GlobalSearch';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /memory/search with correct payload', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { results: [] } });
    vi.mocked(api.get).mockResolvedValue({ data: { sessions: [] } });

    render(<GlobalSearch />);
    
    // Trigger open and search
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'test query' } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/memory/search', {
        query: 'test query',
        limit: 10
      });
    });
  });
});
