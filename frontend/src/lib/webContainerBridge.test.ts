import { describe, it, expect } from 'vitest';
import { toWcPath } from './webContainerBridge';

describe('toWcPath', () => {
  it('strips leading "projects/" prefix', () => {
    expect(toWcPath('projects/myapp/src/foo.tsx')).toBe('myapp/src/foo.tsx');
  });

  it('strips both "projects/" and matching project name', () => {
    expect(toWcPath('projects/myapp/src/foo.tsx', 'myapp')).toBe('src/foo.tsx');
  });

  it('strips bare "<name>/" prefix when projects/ is absent', () => {
    expect(toWcPath('myapp/src/foo.tsx', 'myapp')).toBe('src/foo.tsx');
  });

  it('leaves paths without matching prefix untouched', () => {
    expect(toWcPath('src/foo.tsx', 'myapp')).toBe('src/foo.tsx');
  });

  it('does not strip a project-name substring that is not a full segment', () => {
    expect(toWcPath('myappdata/foo.tsx', 'myapp')).toBe('myappdata/foo.tsx');
  });

  it('strips leading "./"', () => {
    expect(toWcPath('./src/foo.tsx')).toBe('src/foo.tsx');
  });

  it('handles missing projectName', () => {
    expect(toWcPath('projects/myapp/src/foo.tsx', null)).toBe('myapp/src/foo.tsx');
    expect(toWcPath('projects/myapp/src/foo.tsx', undefined)).toBe('myapp/src/foo.tsx');
  });
});
