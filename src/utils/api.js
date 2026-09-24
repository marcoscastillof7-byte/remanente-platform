const API_URL = '/api';

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || 'Error en la solicitud al servidor');
  }

  return response.json();
}

export const api = {
  get: (url) => fetchWithAuth(url),
  post: (url, data) => fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(data) }),
  del: (url) => fetchWithAuth(url, { method: 'DELETE' }),
};
