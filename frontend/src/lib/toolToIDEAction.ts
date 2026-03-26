import type { ToolEvent } from '../store/codingSlice';

/**
 * Maps a completed tool_result event to IDE side-effects.
 * Returns an array of action descriptors that the caller dispatches to the store.
 */

export type IDEAction =
  | { type: 'open_file'; path: string; content: string }
  | { type: 'show_diff'; filePath: string; original: string; modified: string; description: string }
  | { type: 'terminal_output'; lines: string[] }
  | { type: 'show_terminal' }
  | { type: 'refresh_file_tree' };

export function toolResultToIDEActions(event: ToolEvent): IDEAction[] {
  if (event.type !== 'tool_result') return [];
  const result = event.result as Record<string, unknown> | string | undefined;
  const actions: IDEAction[] = [];

  switch (event.tool) {
    case 'read_file': {
      const path = (event.args?.path as string) ?? '';
      const content = typeof result === 'string' ? result : '';
      if (path && content) {
        actions.push({ type: 'open_file', path, content });
      }
      break;
    }

    case 'write_file': {
      const path = (event.args?.path as string) ?? '';
      const newContent = (event.args?.content as string) ?? '';
      if (path) {
        actions.push({ type: 'refresh_file_tree' });
        // Show diff with the written content
        if (newContent) {
          actions.push({
            type: 'show_diff',
            filePath: path,
            original: '', // original not available from this tool
            modified: newContent,
            description: `Agent wrote ${path}`,
          });
        }
      }
      break;
    }

    case 'run_shell': {
      const res = result as Record<string, string> | undefined;
      const lines: string[] = [];
      const cmd = (event.args?.command as string) ?? '';
      if (cmd) lines.push(`$ ${cmd}`);
      if (res?.stdout) lines.push(res.stdout);
      if (res?.stderr) lines.push(`[STDERR]: ${res.stderr}`);
      if (lines.length > 0) {
        actions.push({ type: 'show_terminal' });
        actions.push({ type: 'terminal_output', lines });
      }
      break;
    }

    case 'list_files': {
      actions.push({ type: 'refresh_file_tree' });
      break;
    }

    // IDE-deferred tools (Phase 3)
    case 'ide_open_file': {
      const deferredResult = result as Record<string, unknown> | undefined;
      if (deferredResult?.status === 'deferred_to_frontend') {
        const path = (event.args?.path as string) ?? '';
        if (path) {
          actions.push({ type: 'open_file', path, content: '' }); // content fetched by caller
        }
      }
      break;
    }

    case 'ide_show_diff': {
      const deferredResult = result as Record<string, unknown> | undefined;
      if (deferredResult?.status === 'deferred_to_frontend') {
        const path = (event.args?.path as string) ?? '';
        const content = (event.args?.content as string) ?? '';
        if (path && content) {
          actions.push({
            type: 'show_diff',
            filePath: path,
            original: '',
            modified: content,
            description: `Agent proposed changes to ${path}`,
          });
        }
      }
      break;
    }

    case 'ide_run_in_sandbox': {
      const deferredResult = result as Record<string, unknown> | undefined;
      if (deferredResult?.status === 'deferred_to_frontend') {
        actions.push({ type: 'show_terminal' });
      }
      break;
    }
  }

  return actions;
}
