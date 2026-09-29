const API_URL = '/api';

// Cache en memoria para hacer la app increíblemente rápida (SPA fluid feel)
// Reducido a 2 segundos para evitar spam de re-renders, pero suficientemente corto para que todos los cambios se vean "en vivo" al cambiar de pantalla
const cache = new Map();
const CACHE_TTL = 2000; 

async function fetchWithAuth(endpoint, options = {}, useCache = false) {
  const method = options.method || 'GET';
  
  // Si es un GET y queremos usar caché, retornamos los datos en memoria si no han caducado
  if (useCache && method === 'GET' && cache.has(endpoint)) {
    const { data, timestamp } = cache.get(endpoint);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data; // Instantáneo!
    }
  }

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

  const data = await response.json();

  // Guardar en caché si es GET
  if (useCache && method === 'GET') {
    cache.set(endpoint, { data, timestamp: Date.now() });
  }

  // Si es una mutación (POST, PUT, DELETE), limpiamos toda la caché 
  // para forzar a recargar datos frescos (ej: actualizó su racha, completó un quiz)
  if (method !== 'GET') {
    cache.clear();
  }

  return data;
}

export const api = {
  get: (url, useCache = true) => fetchWithAuth(url, { method: 'GET' }, useCache),
  post: (url, data) => fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(data) }),
  del: (url) => fetchWithAuth(url, { method: 'DELETE' }),
  clearCache: () => cache.clear()
};
