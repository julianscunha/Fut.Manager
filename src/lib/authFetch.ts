/**
 * Shared authenticated HTTP fetch helper.
 * Automatically injects the authenticated user ID, role, and email headers.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const savedUserString = localStorage.getItem('racha_user');
  let userId = '';
  let userRole = '';
  let userEmail = '';

  if (savedUserString) {
    try {
      const parsed = JSON.parse(savedUserString);
      userId = parsed?.id || '';
      userRole = parsed?.role || '';
      userEmail = parsed?.email || '';
    } catch (e) {
      console.error('Error parsing racha_user from localStorage', e);
    }
  }

  const modifiedInit: RequestInit = { ...init };
  const originalHeaders = init?.headers || {};

  // Construct headers
  const headers = new Headers(originalHeaders);
  
  if (userId) {
    headers.set('x-user-id', userId);
  }
  if (userRole) {
    headers.set('x-user-role', userRole);
  }
  if (userEmail) {
    headers.set('x-user-email', userEmail);
  }

  // Set default content type if not present and body is JSON string
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  modifiedInit.headers = headers;

  return fetch(input, modifiedInit);
}
