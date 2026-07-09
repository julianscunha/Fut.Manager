/**
 * Shared authenticated HTTP fetch helper.
 * Automatically injects the session token (JWT) issued at login as a Bearer header.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('racha_token');

  const modifiedInit: RequestInit = { ...init };
  const originalHeaders = init?.headers || {};

  const headers = new Headers(originalHeaders);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set default content type if not present and body is JSON string
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  modifiedInit.headers = headers;

  const response = await fetch(input, modifiedInit);

  // Sessão inválida/ausente/expirada (ex: sessão de antes desta migração, sem token): limpa e volta ao login.
  if (response.status === 401) {
    localStorage.removeItem('racha_user');
    localStorage.removeItem('racha_token');
    window.location.reload();
  }

  return response;
}
