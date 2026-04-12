import { describe, it, expect } from 'vitest';
import { parseSlashCommand, buildSystemPrompt, SLASH_COMMANDS } from './slashCommands';

describe('parseSlashCommand', () => {
  it('returns null for plain text', () => {
    expect(parseSlashCommand('hello world')).toBeNull();
  });
  it('returns command for /fix', () => {
    expect(parseSlashCommand('/fix the return type')).toEqual({
      command: 'fix',
      rest: 'the return type',
    });
  });
  it('returns command for /explain with no rest', () => {
    expect(parseSlashCommand('/explain')).toEqual({ command: 'explain', rest: '' });
  });
  it('returns parsed command even for unknown command ids', () => {
    expect(parseSlashCommand('/unknown some text')).toEqual({ command: 'unknown', rest: 'some text' });
  });
  it('returns null for inputs starting with //', () => {
    expect(parseSlashCommand('// a comment')).toBeNull();
  });
});

describe('buildSystemPrompt', () => {
  it('includes active file path and content', () => {
    const prompt = buildSystemPrompt('src/app.ts', 'const x = 1;', null);
    expect(prompt).toContain('src/app.ts');
    expect(prompt).toContain('const x = 1;');
  });
  it('includes selection when provided', () => {
    const prompt = buildSystemPrompt('src/app.ts', 'const x = 1;', 'const x = 1;');
    expect(prompt).toContain('Selected code');
  });
  it('omits file section when filePath is null', () => {
    const prompt = buildSystemPrompt(null, null, null);
    expect(prompt).not.toContain('Active file:');
  });

  it('includes base instructions always', () => {
    const result = buildSystemPrompt(null, null, null);
    expect(result).toContain('senior software engineer');
  });

  it('includes project name when provided', () => {
    const result = buildSystemPrompt(null, null, null, undefined, 'my-app', null);
    expect(result).toContain('Project: my-app');
  });

  it('includes preview URL and fetch hint when provided', () => {
    const result = buildSystemPrompt(null, null, null, undefined, null, 'http://localhost:3000');
    expect(result).toContain('http://localhost:3000');
    expect(result).toContain('fetch_preview_source');
  });

  it('includes active file when no all-files list', () => {
    const result = buildSystemPrompt('src/App.tsx', 'const App = () => null;', null);
    expect(result).toContain('src/App.tsx');
    expect(result).toContain('const App = () => null;');
  });

  it('includes all open files when list provided with 2+ entries', () => {
    const files = [
      { path: 'src/App.tsx', content: 'const App = 1;' },
      { path: 'src/utils.ts', content: 'export const add = 2;' },
    ];
    const result = buildSystemPrompt(null, null, null, files);
    expect(result).toContain('src/App.tsx');
    expect(result).toContain('const App = 1;');
    expect(result).toContain('src/utils.ts');
    expect(result).toContain('export const add = 2;');
  });

  it('truncates file content beyond 4000 chars', () => {
    const longContent = 'x'.repeat(5000);
    const files = [
      { path: 'big.ts', content: longContent },
      { path: 'other.ts', content: 'short' },
    ];
    const result = buildSystemPrompt(null, null, null, files);
    expect(result).toContain('truncated');
    expect(result.length).toBeLessThan(files[0].content.length + 500);
  });
});

describe('SLASH_COMMANDS', () => {
  it('has at least 7 commands', () => {
    expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(7);
  });
});
