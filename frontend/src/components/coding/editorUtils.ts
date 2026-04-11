const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif']);

export function isImageFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.json': 'json', '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.md': 'markdown', '.py': 'python', '.rs': 'rust', '.go': 'go', '.yaml': 'yaml',
  '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml', '.sql': 'sql', '.sh': 'shell',
  '.bash': 'shell', '.zsh': 'shell', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift', '.rb': 'ruby', '.php': 'php',
  '.lua': 'lua', '.r': 'r', '.dockerfile': 'dockerfile', '.graphql': 'graphql',
};

export function getLang(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  if (base === 'Dockerfile') return 'dockerfile';
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return EXT_TO_LANG[ext] ?? 'plaintext';
}
