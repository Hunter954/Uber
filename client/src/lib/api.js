const jsonHeaders = { 'Content-Type': 'application/json' };

export async function api(path, options = {}) {
  const token = localStorage.getItem('uberzinho_token');
  const res = await fetch(path, {
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
