/**
 * Centralized tool definitions for AI providers.
 * This ensures consistency across different services (Gemini, Groq, OpenRouter, etc.)
 * and reduces code duplication.
 */

export const TOOL_DEFINITIONS = [
  {
    name: "read_file",
    description: "Read the contents of a file in the project.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path to file from project root" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write or update a file in the project.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path to file from project root" },
        content: { type: "STRING", description: "The content to write to the file" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_files",
    description: "List files and directories in a specific path.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path to directory (defaults to .)" }
      },
      required: []
    }
  },
  {
    name: "run_shell",
    description: "Execute a shell command in the project root safely.",
    parameters: {
      type: "OBJECT",
      properties: {
        command: { type: "STRING", description: "The bash command to run" }
      },
      required: ["command"]
    }
  },
  {
    name: "web_search",
    description: "Search the web for real-time information using Serper.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "fetch_web_content",
    description: "Fetch the content of a specific URL.",
    parameters: {
      type: "OBJECT",
      properties: {
        url: { type: "STRING", description: "The URL to fetch" }
      },
      required: ["url"]
    }
  },
  {
    name: "capture_ui",
    description: "Capture the current UI state of the IDE as a screenshot and base64 string.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: []
    }
  },
  {
    name: "get_ui_text",
    description: "Extract the structural text and summary of the current workspace.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: []
    }
  },
  {
    name: "resize_image",
    description: "Resize an image file.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Path to the image" },
        width: { type: "NUMBER", description: "New width" },
        height: { type: "NUMBER", description: "New height" }
      },
      required: ["path"]
    }
  },
  {
    name: "apply_image_filter",
    description: "Apply a visual filter to an image.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Path to the image" },
        filter: { 
          type: "STRING", 
          description: "Filter to apply",
          enum: ["grayscale", "sepia", "blur", "sharpen"]
        }
      },
      required: ["path", "filter"]
    }
  },
  {
    name: "crystallize_memory",
    description: "Permanently store a key insight, rule, or solution into the project's long-term vector memory and visual knowledge graph.",
    parameters: {
      type: "OBJECT",
      properties: {
        content: { type: "STRING", description: "The core insight or rule to remember." },
        type: { 
          type: "STRING", 
          description: "Category of memory",
          enum: ["permanent_rule", "technical_fact", "architectural_decision", "solution_pattern"]
        },
        tags: { 
          type: "ARRAY", 
          description: "List of related keywords/concepts",
          items: { type: "STRING" }
        }
      },
      required: ["content", "type"]
    }
  },
  {
    name: "invalidate_memory",
    description: "Mark a specific memory as deprecated or incorrect when a contradiction is found.",
    parameters: {
      type: "OBJECT",
      properties: {
        memoryId: { type: "STRING", description: "The ID of the memory to invalidate." },
        reason: { type: "STRING", description: "Why this memory is being invalidated." },
        replacementId: { type: "STRING", description: "Optional ID of the new memory that replaces it." }
      },
      required: ["memoryId", "reason"]
    }
  },
  // --- Frontend-deferred tools (executed in the browser, not on the server) ---
  {
    name: "ide_open_file",
    description: "Open a file in the IDE editor tab. Use this to show the user a specific file.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path to the file to open in the editor" }
      },
      required: ["path"]
    }
  },
  {
    name: "ide_show_diff",
    description: "Present a side-by-side diff in the IDE for user approval before applying changes.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path to the file being modified" },
        content: { type: "STRING", description: "The proposed new content for the file" },
        description: { type: "STRING", description: "Brief description of the changes" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "ide_run_in_sandbox",
    description: "Run a command in the browser's WebContainer sandbox (Node.js environment). Use this for safe execution in an isolated environment.",
    parameters: {
      type: "OBJECT",
      properties: {
        command: { type: "STRING", description: "The command to run in the sandbox (e.g. 'node index.js', 'npm test')" }
      },
      required: ["command"]
    }
  }
];

/**
 * Transforms tool definitions for Google Gemini format.
 */
export function getGeminiTools() {
  return [
    {
      functionDeclarations: TOOL_DEFINITIONS.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }
  ];
}

/**
 * Transforms tool definitions for OpenAI-compatible providers (Groq, OpenRouter, Deepseek).
 */
export function getOpenAITools() {
  return TOOL_DEFINITIONS.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.keys(tool.parameters.properties).reduce((acc: any, key) => {
          const prop = (tool.parameters.properties as any)[key];
          acc[key] = {
            type: prop.type.toLowerCase(),
            description: prop.description,
            ...(prop.enum ? { enum: prop.enum } : {}),
            ...(prop.items ? { items: { type: prop.items.type.toLowerCase() } } : {})
          };
          return acc;
        }, {}),
        required: tool.parameters.required
      }
    }
  }));
}
