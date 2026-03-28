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
  selection: string | null
): string {
  const parts: string[] = [
    'You are a senior software engineer acting as a coding assistant.',
    'Respond with clear explanations and, when writing code, use code blocks.',
  ];
  if (filePath && fileContent) {
    parts.push(`\nActive file: ${filePath}\n\`\`\`\n${fileContent}\n\`\`\``);
  }
  if (selection) {
    parts.push(`\nSelected code:\n\`\`\`\n${selection}\n\`\`\``);
  }
  return parts.join('\n');
}
