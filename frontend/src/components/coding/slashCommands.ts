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
): string {
  const parts: string[] = [
    'You are a senior software engineer acting as a coding assistant.',
    'Respond with clear explanations and, when writing code, use code blocks.',
  ];

  if (projectName) {
    parts.push(`\nProject: ${projectName}`);
  }

  if (previewUrl) {
    parts.push(
      `\nApp preview URL: ${previewUrl}`,
      'The app is currently running at this URL. Call the `fetch_preview_source` tool with this URL to inspect its current HTML structure.'
    );
  }

  if (openFiles && openFiles.length > 1) {
    parts.push('\nOpen files in editor:');
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

  return parts.join('\n');
}
