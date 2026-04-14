import { describe, it, expect } from 'vitest';
import { isProblematicToolResult, prependTruthfulnessNote } from './baseOpenAIService';

describe('isProblematicToolResult', () => {
  it('flags strings starting with "Error"', () => {
    expect(isProblematicToolResult('Error: file not found')).toBe(true);
    expect(isProblematicToolResult('error: lowercase still counts')).toBe(true);
  });

  it('flags objects with deferred_to_frontend status', () => {
    expect(isProblematicToolResult({ status: 'deferred_to_frontend', tool: 'ide_show_diff' })).toBe(true);
  });

  it('flags objects with a non-empty error field', () => {
    expect(isProblematicToolResult({ error: 'timeout' })).toBe(true);
  });

  it('does not flag successful string results', () => {
    expect(isProblematicToolResult('ok')).toBe(false);
    expect(isProblematicToolResult('File contents here')).toBe(false);
  });

  it('does not flag successful object results', () => {
    expect(isProblematicToolResult({ status: 'success', path: 'a/b' })).toBe(false);
    expect(isProblematicToolResult({ ok: true })).toBe(false);
  });

  it('handles null and undefined', () => {
    expect(isProblematicToolResult(null)).toBe(false);
    expect(isProblematicToolResult(undefined)).toBe(false);
  });

  it('does not flag "errorless" substrings mid-string', () => {
    expect(isProblematicToolResult('No error found here')).toBe(false);
  });
});

describe('prependTruthfulnessNote', () => {
  it('prepends the system note when hadProblems is true', () => {
    const out = prependTruthfulnessNote('Done.', true);
    expect(out).toMatch(/^\[System note:/);
    expect(out).toContain('Done.');
  });

  it('returns the text unchanged when hadProblems is false', () => {
    const out = prependTruthfulnessNote('Done.', false);
    expect(out).toBe('Done.');
  });
});
