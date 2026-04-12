// frontend/src/components/coding/PreviewRuntimeSummary.tsx
import { useAppStore } from '../../store/useAppStore';

export function buildPreviewRuntimeBlock(): string {
  const {
    previewConsoleBuffer,
    previewBodyHash,
    previewDomChanged,
    previewUrl,
  } = useAppStore.getState();

  if (!previewUrl) return '';

  const errorCount = previewConsoleBuffer.filter(e => e.level === 'error').length;
  const warnCount = previewConsoleBuffer.filter(e => e.level === 'warn').length;
  const lastError = [...previewConsoleBuffer].reverse().find(e => e.level === 'error');
  const lastErrorAge = lastError ? formatAge(Date.now() - lastError.timestamp) : null;

  const parts: string[] = [];

  if (errorCount > 0 || warnCount > 0) {
    let summary = `console: ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`;
    if (lastError) {
      const msg = lastError.message.slice(0, 120);
      summary += ` | last-error: "${msg}" (${lastErrorAge ?? 'just now'})`;
    }
    parts.push(summary);
  } else {
    parts.push('console: clean');
  }

  if (previewBodyHash) {
    parts.push(`dom-hash: ${previewBodyHash} | changed: ${previewDomChanged} since last turn`);
  }

  parts.push('preview: running');

  return `\n\n<preview-runtime>\n${parts.join('\n')}\n</preview-runtime>`;
}

function formatAge(ms: number): string {
  if (ms < 1000) return 'just now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}
