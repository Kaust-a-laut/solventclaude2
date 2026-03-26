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
 * Run a command in the WebContainer sandbox.
 * Returns stdout and exit code.
 */
export async function runInSandbox(command: string): Promise<{ stdout: string; exitCode: number }> {
  const wc = wcInstance;
  if (!wc) throw new Error('WebContainer not booted');

  const parts = command.trim().split(/\s+/);
  const executable = parts[0];
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
