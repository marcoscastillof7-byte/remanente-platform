const API_URL = '/api';

// Cache en memoria para hacer la app increíblemente rápida (SPA fluid feel)
const cache = new Map();
// Deduplicador de peticiones en vuelo (evita que 2 componentes pidan lo mismo a la vez)
const inFlight = new Map();

const DEFAULT_CACHE_TTL = 3000; // 3 segundos para navegación fluida
const LONG_CACHE_TTL = 30000;   // 30 segundos para catálogos estáticos (/books)

function getTtlForEndpoint(endpoint) {
  if (endpoint.startsWith('/books')) return LONG_CACHE_TTL;
  if (endpoint.startsWith('/historical-details')) return LONG_CACHE_TTL;
  return DEFAULT_CACHE_TTL;
}

async function fetchWithAuth(endpoint, options = {}, useCache = false) {
  const method = options.method || 'GET';
  const ttl = getTtlForEndpoint(endpoint);
  
  // 1. Si es GET y los datos en memoria están frescos, retornar de inmediato (0ms de latencia)
  if (useCache && method === 'GET' && cache.has(endpoint)) {
    const { data, timestamp } = cache.get(endpoint);
    if (Date.now() - timestamp < ttl) {
      return data;
    }
  }

  // 2. Si ya hay una petición exactamente igual en vuelo, reutilizar la misma promesa
  if (useCache && method === 'GET' && inFlight.has(endpoint)) {
    return inFlight.get(endpoint);
  }

  const token = localStorage.getItem('token');
  const localDate = new Date().toLocaleDateString('en-CA');
  const headers = {
    'Content-Type': 'application/json',
    'x-client-date': localDate,
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Timeout preventivo de 12 segundos para conexiones móviles lentas
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const executeRequest = (async () => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
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
      // para forzar a recargar datos frescos
      if (method !== 'GET') {
        cache.clear();
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('La conexión tardó demasiado. Por favor verifica tu señal.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (method === 'GET') {
        inFlight.delete(endpoint);
      }
    }
  })();

  if (useCache && method === 'GET') {
    inFlight.set(endpoint, executeRequest);
  }

  return executeRequest;
}

export const api = {
  get: (url, useCache = true) => fetchWithAuth(url, { method: 'GET' }, useCache),
  post: (url, data) => fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(data) }),
  del: (url) => fetchWithAuth(url, { method: 'DELETE' }),
  clearCache: () => {
    cache.clear();
    inFlight.clear();
  }
};
