export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  systemInstruction: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'fix',      label: '/fix',      description: 'Fix bugs & errors',       systemInstruction: 'Fix all bugs and errors in the provided code. Return only the corrected code.' },
  { id: 'explain',  label: '/explain',  description: 'Explain selected code',    systemInstruction: 'Explain what the provided code does in clear, concise terms.' },
  { id: 'test',     label: '/test',     description: 'Generate unit tests',      systemInstruction: "Generate comprehensive unit tests for the provided code using the project's test framework." },
  { id: 'refactor', label: '/refactor', description: 'Refactor with reasoning',  systemInstruction: 'Refactor the provided code for clarity, maintainability, and modern patterns. Explain each change.' },
  { id: 'optimize', label: '/optimize', description: 'Performance optimization', systemInstruction: 'Optimize the provided code for performance. Explain the improvements.' },
  { id: 'docs',     label: '/docs',     description: 'Add JSDoc comments',       systemInstruction: 'Add clear, accurate JSDoc/inline comments to the provided code.' },
  { id: 'commit',   label: '/commit',   description: 'Generate commit message',  systemInstruction: 'Generate a conventional git commit message for the provided changes.' },
  { id: 'project',  label: '/project',  description: 'Ask about project structure & files', systemInstruction: 'You have been given the full list of open project files. Help the user understand, navigate, or modify their project. When proposing changes use ide_show_diff.' },
];

export interface ParsedCommand {
  command: string;
  rest: string;
}

export function parseSlashCommand(input: string): ParsedCommand | null {
  const match = input.match(/^\/([a-z]+)\s*(.*)/s);
  if (!match) return null;
  return { command: match[1] ?? '', rest: (match[2] ?? '').trim() };
}

export function buildSystemPrompt(
  filePath: string | null,
  fileContent: string | null,
  selection: string | null,
  openFiles?: Array<{ path: string; content: string }>,
  projectName?: string | null,
  previewUrl?: string | null,
  previewSelectedElement?: { tag: string; classes: string[]; text: string } | null,
  tier?: 'full-agentic' | 'code-only',
): string {
  const parts: string[] = [
    'You are a senior software engineer acting as a coding assistant.',
    'Respond with clear explanations and, when writing code, use code blocks.',
  ];

  if (projectName) {
    parts.push(`\nProject: ${projectName}`);
  }

  if (previewUrl) {
    parts.push(`\nApp preview URL: ${previewUrl}`);
    parts.push('The app is currently running at this URL.');
    parts.push('IMPORTANT: When the user asks to change, add, or fix something in the app, they are referring to the running preview.');
    parts.push('');
    parts.push('IMPORTANT — Preview rendering:');
    parts.push('This app uses a JavaScript framework (React/Vue/Svelte/etc). `fetch_preview_source` returns the raw HTML skeleton only — the JS has not run yet, so reading it is usually not useful.');
    parts.push('');
    parts.push('Workflow for UI changes:');
    parts.push('1. Identify which source file(s) own the relevant component (check the open files list above)');
    parts.push('2. `read_file` — confirm the current implementation');
    parts.push('3. Make the change with `ide_show_diff` (user approval required) or `write_file` (direct write)');
    parts.push('4. The preview auto-refreshes after a successful write.');
  }

  if (openFiles && openFiles.length > 1) {
    // Add project structure awareness
    const filePaths = openFiles.map(f => f.path);
    const dirs = [...new Set(filePaths.map(p => p.split('/').slice(0, -1).join('/')).filter(Boolean))];
    parts.push('\nProject structure (from open files):');
    parts.push('Available files and directories:');
    for (const p of filePaths.sort()) {
      parts.push(`  - ${p}`);
    }
    if (dirs.length > 0) {
      parts.push(`\nTop-level directories: ${dirs.slice(0, 8).join(', ')}${dirs.length > 8 ? '...' : ''}`);
      parts.push('Use `list_files` to explore directories before guessing file paths.');
    }

    parts.push('\nFile contents:');
    for (const f of openFiles) {
      const snippet = f.content.length > 4000
        ? f.content.slice(0, 4000) + '\n... (truncated)'
        : f.content;
      parts.push(`\n### ${f.path}\n\`\`\`\n${snippet}\n\`\`\``);
    }
  } else if (filePath && fileContent) {
    parts.push(`\nActive file: ${filePath}\n\`\`\`\n${fileContent}\n\`\`\``);
  }

  if (selection) {
    parts.push(`\nSelected code:\n\`\`\`\n${selection}\n\`\`\``);
  }

  if (previewSelectedElement) {
    const { tag, classes, text } = previewSelectedElement;
    const classStr = classes.join('.');
    parts.push(
      `\nSelected element: <${tag}${classStr ? ' class="' + classStr + '"' : ''}>${text}</${tag}>`,
      `The user has selected this element from the preview. Call get_selected_element() to see its full details.`
    );
  }

  if (tier === 'full-agentic') {
    parts.push(`
When a task is self-contained, file-scoped, and doesn't require reasoning about broader system state,
use the <delegate-candidate> format to delegate to a code-tier model:

<delegate-candidate>
  <task>Brief description of the task</task>
  <files>src/components/FileName.tsx</files>
  <context>Relevant context for the code-tier model</context>
</delegate-candidate>

Use this for boilerplate, UI scaffolding, and isolated component changes.`);
  }

  return parts.join('\n');
}
