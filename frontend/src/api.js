const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export async function api(path, { negocioId, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (negocioId) headers.set('X-Negocio-Id', negocioId);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Error HTTP ${response.status}`);
  }
  return payload;
}

export const apiUrl = API_URL;
export const assetUrl = (path) => (
  path && path.startsWith('/uploads/') ? `${API_URL}${path}` : path
);
