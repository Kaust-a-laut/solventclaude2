import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../store/useAppStore';
import { useModelCapabilities } from './useModelCapabilities';

describe('useModelCapabilities', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedCloudModel: 'compound-beta',
      selectedCloudProvider: 'groq',
    });
  });

  it('returns full-agentic for Claude Sonnet 4', () => {
    useAppStore.setState({ selectedCloudModel: 'anthropic/claude-sonnet-4', selectedCloudProvider: 'openrouter' });
    const { result } = renderHook(() => useModelCapabilities());
    expect(result.current.tier).toBe('full-agentic');
    expect(result.current.canUseRuntimeTools).toBe(true);
    expect(result.current.canUseScreenshots).toBe(true);
    expect(result.current.canUseClickToEdit).toBe(true);
    expect(result.current.traits.multimodal).toBe(true);
  });

  it('returns full-agentic non-multimodal for Groq Compound', () => {
    const { result } = renderHook(() => useModelCapabilities());
    expect(result.current.tier).toBe('full-agentic');
    expect(result.current.canUseRuntimeTools).toBe(true);
    expect(result.current.canUseScreenshots).toBe(false);
    expect(result.current.canUseClickToEdit).toBe(true);
  });

  it('returns code-only for Llama 4 Maverick', () => {
    useAppStore.setState({ selectedCloudModel: 'accounts/fireworks/models/llama4-maverick-instruct-basic', selectedCloudProvider: 'fireworks' });
    const { result } = renderHook(() => useModelCapabilities());
    expect(result.current.tier).toBe('code-only');
    expect(result.current.canUseRuntimeTools).toBe(false);
    expect(result.current.canUseScreenshots).toBe(false);
    expect(result.current.canUseClickToEdit).toBe(false);
  });

  it('returns all false for unknown model', () => {
    useAppStore.setState({ selectedCloudModel: 'unknown-model', selectedCloudProvider: 'unknown' });
    const { result } = renderHook(() => useModelCapabilities());
    expect(result.current.tier).toBe('code-only');
    expect(result.current.canUseRuntimeTools).toBe(false);
    expect(result.current.canUseScreenshots).toBe(false);
    expect(result.current.canUseClickToEdit).toBe(false);
  });
});
