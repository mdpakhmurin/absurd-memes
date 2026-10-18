export const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export async function fetchJson(url, { signal, timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// MediaWiki API: origin=* включает анонимный CORS, ключ не нужен.
export async function wikiApi(host, params, opts) {
  const url = new URL(`https://${host}/w/api.php`);
  const all = { format: 'json', formatversion: '2', origin: '*', ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  const data = await fetchJson(url, opts);
  if (data.error) throw new Error(data.error.info || 'MediaWiki error');
  return data;
}
