export interface RequestOptions extends RequestInit {
  retries?: number;
  backoff?: number;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  status?: number;
  [key: string]: unknown;
}

export class APIError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public statusText?: string,
    public body?: ApiErrorResponse | string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

let cachedSecret: string | null = null;

/**
 * Retrieves the session secret for authenticating with the backend.
 *
 * Priority order:
 * 1. Electron preload: `window.electron.getSessionSecret()`
 * 2. Env override: `VITE_BACKEND_SECRET` in frontend/.env
 * 3. Dev auto-fallback: fetches from `GET /dev-secret` (backend-only, localhost, dev mode)
 *    — no .env file required when running `npm run dev` in both frontend/ and backend/
 *
 * @throws {Error} Only in production builds without Electron, or if backend is unreachable
 */
export async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  // Primary: Electron preload provides the secret
  if (window.electron?.getSessionSecret) {
    cachedSecret = await window.electron.getSessionSecret();
    return cachedSecret!;
  }

  // Dev mode fallback: read secret from Vite env variable
  // Set VITE_BACKEND_SECRET in frontend/.env to match BACKEND_INTERNAL_SECRET
  const devSecret = (import.meta as any).env?.VITE_BACKEND_SECRET;
  if (devSecret) {
    cachedSecret = devSecret;
    return cachedSecret!;
  }

  // Dev auto-fallback: fetch the actual secret from the backend's /dev-secret endpoint.
  // Mirrors what Electron's window.electron.getSessionSecret() preload does —
  // the backend already has the correct secret; we just ask for it over localhost.
  // /dev-secret only exists in NODE_ENV=development and only responds to localhost IPs.
  // In production builds import.meta.env.DEV is false so this branch never runs.
  if ((import.meta as any).env?.DEV) {
    try {
      const res = await fetch('/dev-secret');
      if (res.ok) {
        const data = await res.json() as { secret: string };
        cachedSecret = data.secret;
        return cachedSecret!;
      }
    } catch {
      // Backend not running yet — fall through to error below
    }
  }

  // No auth available (production browser without Electron, or backend unreachable in dev)
  throw new Error(
    'Authentication unavailable: ensure the backend is running (npm run dev in backend/).'
  );
}

export async function fetchWithRetry<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { retries = 3, backoff = 1000, ...fetchOptions } = options;
  const secret = await getSecret();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
        'X-Solvent-Secret': secret
      };

      // If body is FormData, don't set Content-Type header to allow browser to set boundary
      if (options.body instanceof FormData) {
        delete headers['Content-Type'];
      }

      const response = await fetch(url, { ...fetchOptions, signal: options.signal, headers });

      if (!response.ok) {
        let errorBody: ApiErrorResponse | string;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }

        const error = new APIError(
          `Request failed with status ${response.status}`,
          response.status,
          response.statusText,
          errorBody
        );

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw error;
        }

        throw error;
      }

      return await response.json() as T;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry client errors (4xx) — they won't succeed on retry
      if (lastError instanceof APIError && lastError.status && lastError.status >= 400 && lastError.status < 500) {
        throw lastError;
      }

      console.error(`[API] Attempt ${attempt + 1} failed:`, {
        message: lastError.message,
        status: (lastError as APIError).status,
        body: (lastError as APIError).body
      });

      if (attempt < retries - 1) {
        // Check abort signal before sleeping
        if (options.signal?.aborted) throw lastError;
        const delay = backoff * Math.pow(2, attempt);
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
