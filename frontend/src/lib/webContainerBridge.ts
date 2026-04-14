import { WebContainer } from '@webcontainer/api';

/**
 * WebContainer singleton bridge.
 * Extracted from CodingArea.tsx so both the editor and the agent can access
 * the same WebContainer instance.
 */

let wcInstance: WebContainer | null = null;
let wcBootPromise: Promise<WebContainer> | null = null;

export function getOrBootWebContainer(): Promise<WebContainer> {
  if (wcInstance) return Promise.resolve(wcInstance);
  if (wcBootPromise) return wcBootPromise;
  wcBootPromise = WebContainer.boot().then((wc) => {
    wcInstance = wc;
    wcBootPromise = null;
    return wc;
  }).catch((err) => {
    wcBootPromise = null;
    throw err;
  });
  return wcBootPromise;
}

export function getWebContainerInstance(): WebContainer | null {
  return wcInstance;
}

export function setWebContainerInstance(wc: WebContainer): void {
  wcInstance = wc;
}

export function clearBootPromise(): void {
  wcBootPromise = null;
}

/**
 * Translate an agent/backend-style path into a WebContainer-root-relative path.
 * Strips leading `projects/` and a leading `<projectName>/` segment if present.
 */
export function toWcPath(p: string, projectName?: string | null): string {
  let out = p.replace(/^\.\//, '');
  if (out.startsWith('projects/')) out = out.slice('projects/'.length);
  if (projectName && out.startsWith(projectName + '/')) {
    out = out.slice(projectName.length + 1);
  }
  return out;
}

/**
 * Write a file into the WebContainer fs, creating parent directories as needed.
 * Silent no-op if the WC isn't booted — the preview just won't update until boot.
 */
export async function writeFileToWebContainer(wcRelPath: string, content: string): Promise<void> {
  const wc = wcInstance;
  if (!wc || !wcRelPath) return;
  const parts = wcRelPath.split('/').filter(Boolean);
  if (parts.length > 1) {
    const dir = parts.slice(0, -1).join('/');
    try {
      await wc.fs.mkdir(dir, { recursive: true });
    } catch {
      // directory may already exist
    }
  }
  await wc.fs.writeFile(wcRelPath, content);
}

/**
 * Run a command in the WebContainer sandbox.
 * Returns stdout and exit code.
 */
export async function runInSandbox(command: string): Promise<{ stdout: string; exitCode: number }> {
  const wc = wcInstance;
  if (!wc) throw new Error('WebContainer not booted');

  const parts = command.trim().split(/\s+/);
  const executable = parts[0] ?? '';
  const args = parts.slice(1);

  const proc = await wc.spawn(executable, args);
  let stdout = '';
  const outputStream = new WritableStream({
    write(data) {
      stdout += data;
    },
  });
  proc.output.pipeTo(outputStream);
  const exitCode = await proc.exit;
  return { stdout, exitCode };
}
