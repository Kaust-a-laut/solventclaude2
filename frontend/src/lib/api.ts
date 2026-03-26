import { fetchWithRetry } from './api-client';

const API_BASE = '/api/v1';

interface ApiClient {
  get: <T = any>(url: string, options?: RequestInit) => Promise<{ data: T }>;
  post: <T = any>(url: string, data?: any, options?: RequestInit) => Promise<{ data: T }>;
  put: <T = any>(url: string, data?: any, options?: RequestInit) => Promise<{ data: T }>;
  delete: <T = any>(url: string, options?: RequestInit) => Promise<{ data: T }>;
  patch: <T = any>(url: string, data?: any, options?: RequestInit) => Promise<{ data: T }>;
}

async function request<T = any>(
  url: string,
  method: string,
  body?: any,
  options?: RequestInit
): Promise<{ data: T }> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  const fetchOptions: RequestInit = {
    method,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const result = await fetchWithRetry<T>(fullUrl, fetchOptions);
  return { data: result };
}

export const api: ApiClient = {
  get: (url, options) => request(url, 'GET', undefined, options),
  post: (url, data, options) => request(url, 'POST', data, options),
  put: (url, data, options) => request(url, 'PUT', data, options),
  delete: (url, options) => request(url, 'DELETE', undefined, options),
  patch: (url, data, options) => request(url, 'PATCH', data, options),
};
