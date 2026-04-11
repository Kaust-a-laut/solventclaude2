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

export interface ViteEnv {
  VITE_BACKEND_SECRET?: string;
  DEV?: boolean;
  [key: string]: unknown;
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
  const env = import.meta.env as ViteEnv;
  const devSecret = env?.VITE_BACKEND_SECRET;
  if (devSecret) {
    cachedSecret = devSecret;
    return cachedSecret!;
  }

  // Dev auto-fallback: fetch the actual secret from the backend's /dev-secret endpoint.
  // Mirrors what Electron's window.electron.getSessionSecret() preload does —
  // the backend already has the correct secret; we just ask for it over localhost.
  // /dev-secret only exists in NODE_ENV=development and only responds to localhost IPs.
  // In production builds import.meta.env.DEV is false so this branch never runs.
  if (env?.DEV) {
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
        let errorMessage = `Request failed with status ${response.status}`;
        
        try {
          // Clone the response so we can read the body without consuming the original
          const clonedResponse = response.clone();
          try {
            errorBody = await clonedResponse.json();
          } catch {
            errorBody = await clonedResponse.text();
          }
          
          // Extract error message from the body if available
          if (typeof errorBody === 'object' && errorBody !== null) {
            const bodyObj = errorBody as Record<string, unknown>;
            if (typeof bodyObj.message === 'string') {
              errorMessage = bodyObj.message;
            } else if (typeof bodyObj.error === 'string') {
              errorMessage = bodyObj.error;
            }
          } else if (typeof errorBody === 'string') {
            errorMessage = errorBody;
          }
        } catch {
          // If we can't read the body at all, use a generic message
          errorBody = { message: errorMessage };
        }

        const error = new APIError(
          errorMessage,
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

export interface TraceFilter {
  limit?: number;
  query?: string;
  mode?: string;
  since?: string;
  outcome?: string;
  sessionId?: string;
}

export async function getTraces(filter: TraceFilter = {}): Promise<any[]> {
  const { API_BASE_URL } = await import('./config');
  const params = new URLSearchParams();
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.query) params.set('query', filter.query);
  if (filter.mode) params.set('mode', filter.mode);
  if (filter.since) params.set('since', filter.since);
  if (filter.outcome) params.set('outcome', filter.outcome);
  if (filter.sessionId) params.set('sessionId', filter.sessionId);

  const url = `${API_BASE_URL}/debug/traces${params.toString() ? '?' + params.toString() : ''}`;
  try {
    const secret = await getSecret();
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-Solvent-Secret': secret }
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function updateTraceOutcome(
  traceId: string,
  outcome: 'correction' | 'crystallized' | 'rerequested' | 'accepted'
): Promise<void> {
  const { API_BASE_URL } = await import('./config');
  try {
    const secret = await getSecret();
    await fetch(`${API_BASE_URL}/debug/traces/${traceId}/outcome`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Solvent-Secret': secret },
      body: JSON.stringify({ outcome }),
    });
  } catch {
    // Fire-and-forget from UI — silently swallow network errors
  }
}

export interface OptimizationConfig {
  maxIterations?: number;
  candidatesPerIteration?: number;
  searchSetQuery?: string;
  minTraceCount?: number;
}

export interface OptimizationRun {
  id?: string;
  status?: string;
  config?: OptimizationConfig;
  results?: Record<string, unknown>[];
  [key: string]: unknown;
}

export async function startOptimization(config: OptimizationConfig = {}): Promise<OptimizationRun | null> {
  const { API_BASE_URL } = await import('./config');
  try {
    const secret = await getSecret();
    const res = await fetch(`${API_BASE_URL}/harness/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Solvent-Secret': secret },
      body: JSON.stringify(config),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function cancelOptimization(runId: string): Promise<boolean> {
  const { API_BASE_URL } = await import('./config');
  try {
    const secret = await getSecret();
    const res = await fetch(`${API_BASE_URL}/harness/optimize/${runId}/cancel`, {
      method: 'POST',
      headers: { 'X-Solvent-Secret': secret },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getOptimizationRun(runId: string): Promise<OptimizationRun | null> {
  const { API_BASE_URL } = await import('./config');
  try {
    const secret = await getSecret();
    const res = await fetch(`${API_BASE_URL}/harness/runs/${runId}`, {
      headers: { 'X-Solvent-Secret': secret },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function listOptimizationRuns(): Promise<OptimizationRun[]> {
  const { API_BASE_URL } = await import('./config');
  try {
    const secret = await getSecret();
    const res = await fetch(`${API_BASE_URL}/harness/runs`, {
      headers: { 'X-Solvent-Secret': secret },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function subscribeToOptimizationRun(runId: string, onUpdate: (run: OptimizationRun) => void): () => void {
  const { API_BASE_URL } = require('./config');
  const url = `${API_BASE_URL}/harness/runs/${runId}/stream`;
  const evtSource = new EventSource(url);
  evtSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      evtSource.close();
      return;
    }
    try {
      onUpdate(JSON.parse(event.data));
    } catch { /* ignore parse errors */ }
  };
  return () => evtSource.close();
}
