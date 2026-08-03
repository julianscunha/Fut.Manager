/**
 * Centralized API client with typed requests/responses.
 * Handles JWT injection, error handling, and request/response models.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Centralized HTTP client for all API calls.
 * - Injects JWT token automatically
 * - Handles authentication errors
 * - Provides typed request/response
 */
export class ApiClient {
  private baseUrl: string = '';
  private tokenKey = 'racha_token';
  private userKey = 'racha_user';

  /**
   * Execute typed API request
   */
  async request<T>(
    path: string,
    init?: ApiRequestInit
  ): Promise<T> {
    const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
    const token = this.getToken();

    const headers = new Headers(init?.headers || {});

    // Inject JWT token if available
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Auto-detect JSON body
    if (init?.body && typeof init.body !== 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...init,
      headers,
      body: init?.body
        ? typeof init.body === 'string'
          ? init.body
          : JSON.stringify(init.body)
        : undefined,
    });

    // Handle authentication failure
    if (response.status === 401) {
      this.clearAuth();
      window.location.reload();
      throw new ApiError(401, 'Unauthorized');
    }

    // Handle other HTTP errors
    if (!response.ok) {
      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      throw new ApiError(
        response.status,
        `HTTP ${response.status}`,
        data
      );
    }

    // Parse response
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, init?: Omit<ApiRequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, init?: Omit<ApiRequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown, init?: Omit<ApiRequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: unknown, init?: Omit<ApiRequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, init?: Omit<ApiRequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  // --- Auth Management ---

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  clearAuth(): void {
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey);
  }
}

// Singleton instance
export const apiClient = new ApiClient();
