import { ApiErrorResponse } from '../types/auth';
import { handleMockFallback } from './mockFallback';

export class ApiClientError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)hmcs_csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  const cleanBase = baseUrl.replace(/\/$/, '');
  const url = endpoint.startsWith('http')
    ? endpoint
    : cleanBase
    ? `${cleanBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
    : endpoint;

  const headers = new Headers(options.headers || {});

  // Add Content-Type if payload is present and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add X-CSRF-Token header if available for state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are always sent and received
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    const mockData = handleMockFallback<T>(endpoint, options);
    if (mockData !== null) {
      return mockData;
    }
    throw new ApiClientError(
      netErr instanceof Error ? netErr.message : 'Network request failed',
      'NETWORK_ERROR',
      0
    );
  }

  // If status is 404 or server error (e.g. backend not deployed), attempt mock fallback
  if (response.status === 404 || response.status >= 500) {
    const mockData = handleMockFallback<T>(endpoint, options);
    if (mockData !== null) {
      return mockData;
    }
  }

  // If 401 Unauthorized occurs on an authenticated route (not login or refresh itself), attempt token refresh once
  if (
    response.status === 401 &&
    !endpoint.includes('/api/auth/student/login') &&
    !endpoint.includes('/api/auth/warden/login') &&
    !endpoint.includes('/api/auth/refresh')
  ) {
    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve: () => {
            resolve(apiRequest<T>(endpoint, options));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!refreshRes.ok) {
        throw new Error('Session expired');
      }

      processQueue(null);
      // Retry original request
      return await apiRequest<T>(endpoint, options);
    } catch (refreshErr) {
      processQueue(refreshErr instanceof Error ? refreshErr : new Error('Refresh failed'));
      throw new ApiClientError('Session expired. Please sign in again.', 'UNAUTHORIZED', 401);
    } finally {
      isRefreshing = false;
    }
  }

  // Parse JSON response body
  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
    // If an API request returned HTML (such as index.html from static SPA rewrite), fallback to mock
    if (typeof data === 'string' && data.trim().startsWith('<')) {
      const mockData = handleMockFallback<T>(endpoint, options);
      if (mockData !== null) {
        return mockData;
      }
    }
  }

  if (!response.ok) {
    const mockData = handleMockFallback<T>(endpoint, options);
    if (mockData !== null) {
      return mockData;
    }

    const errorBody = data as ApiErrorResponse | null;
    const message =
      errorBody?.error?.message ||
      (typeof data === 'string' ? data : `Request failed with status ${response.status}`);
    const code = errorBody?.error?.code || `HTTP_${response.status}`;

    throw new ApiClientError(message, code, response.status);
  }

  return data as T;
}
