import { IToolPlugin } from '../../types/plugins';
import fs from 'fs/promises';
import path from 'path';

export class FileToolPlugin implements IToolPlugin {
  id = 'file_tool';
  name = 'File Operations Tool';
  description = 'Provides file read/write operations';
  version = '1.0.0';

  schema = {
    name: 'file_operations',
    description: 'Perform file operations like read, write, list',
    parameters: {
      type: 'object' as const,
      properties: {
        operation: {
          type: 'string',
          enum: ['read', 'write', 'list'],
          description: 'The file operation to perform'
        },
        path: {
          type: 'string',
          description: 'The file or directory path'
        },
        content: {
          type: 'string',
          description: 'Content to write (for write operation)'
        }
      },
      required: ['operation', 'path']
    }
  };

  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../../../../'); // Go up to project root
  }

  async initialize(_options: Record<string, unknown>): Promise<void> {
    // Initialize any required resources
  }

  isReady(): boolean {
    return true; // Always ready since it just uses fs
  }

  validate(args: Record<string, unknown>): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const operation = args.operation as string | undefined;

    if (!operation) {
      errors.push('Operation is required');
    } else if (!['read', 'write', 'list'].includes(operation)) {
      errors.push('Operation must be one of: read, write, list');
    }

    if (!args.path) {
      errors.push('Path is required');
    }

    if (operation === 'write' && args.content === undefined) {
      errors.push('Content is required for write operation');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const operation = args.operation as string;
    const filePath = args.path as string;
    const content = args.content as string | undefined;

    switch (operation) {
      case 'read':
        return await this.readFile(filePath);
      case 'write':
        return await this.writeFile(filePath, content ?? '');
      case 'list':
        return await this.listFiles(filePath);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  private async readFile(filePath: string) {
    const fullPath = path.join(this.rootDir, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return { status: 'success', content, path: filePath };
  }

  private async writeFile(filePath: string, content: string) {
    const fullPath = path.join(this.rootDir, filePath);
    await fs.writeFile(fullPath, content);
    return { status: 'success', path: filePath };
  }

  private async listFiles(dirPath: string) {
    const fullPath = path.join(this.rootDir, dirPath);
    const dirents = await fs.readdir(fullPath, { withFileTypes: true });
    return dirents.map(dirent => ({
      name: dirent.name,
      type: dirent.isDirectory() ? 'directory' : 'file'
    }));
  }
}

// Export as default for dynamic loading
export default FileToolPlugin;