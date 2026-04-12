import { describe, it, expect } from 'vitest';
import { parseDelegateCandidate } from './DelegateCandidateCard';

describe('parseDelegateCandidate', () => {
  it('parses valid delegate block', () => {
    const text = `Some text before
<delegate-candidate>
  <task>Add loading spinner</task>
  <files>src/components/SubmitButton.tsx</files>
  <context>Current button code</context>
</delegate-candidate>
Some text after`;
    const result = parseDelegateCandidate(text);
    expect(result).not.toBeNull();
    expect(result!.task).toBe('Add loading spinner');
    expect(result!.files).toEqual(['src/components/SubmitButton.tsx']);
    expect(result!.context).toBe('Current button code');
  });

  it('returns null for malformed XML', () => {
    expect(parseDelegateCandidate('<delegate-candidate>unclosed')).toBeNull();
    expect(parseDelegateCandidate('no delegate block')).toBeNull();
  });

  it('handles missing fields gracefully', () => {
    const result = parseDelegateCandidate('<delegate-candidate></delegate-candidate>');
    expect(result).not.toBeNull();
    expect(result!.task).toBe('');
    expect(result!.files).toEqual([]);
    expect(result!.context).toBe('');
  });

  it('handles multiple files', () => {
    const result = parseDelegateCandidate(
      '<delegate-candidate><files>src/a.ts, src/b.ts\nsrc/c.ts</files></delegate-candidate>'
    );
    expect(result!.files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });
});
