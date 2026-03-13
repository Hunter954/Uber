const jsonHeaders = { 'Content-Type': 'application/json' };

const isAbsolute = (value) => /^https?:\/\//i.test(value || '');

function buildUrl(path) {
  if (isAbsolute(path)) return path;
  return path;
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('uberzinho_token');
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Erro na requisição.');
  return data;
}

export async function geocodeAddress(query, around) {
  if (!query?.trim()) throw new Error('Digite um endereço.');

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });

  if (around?.lat && around?.lng) {
    params.set('viewbox', `${around.lng - 0.25},${around.lat + 0.25},${around.lng + 0.25},${around.lat - 0.25}`);
    params.set('bounded', '0');
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Não consegui buscar esse endereço agora.');
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) throw new Error('Endereço não encontrado.');

  return {
    label: data[0].display_name,
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    options: data,
  };
}

export async function getRoutePath(points) {
  const valid = (points || []).filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
  if (valid.length < 2) return [];

  const coords = valid.map((point) => `${point.lng},${point.lat}`).join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
  });

  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?${params.toString()}`);
  if (!response.ok) throw new Error('Não consegui montar o trajeto.');

  const data = await response.json();
  const route = data?.routes?.[0]?.geometry?.coordinates || [];
  return route.map(([lng, lat]) => [lat, lng]);
}
