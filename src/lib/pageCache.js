/**
 * pageCache.js
 * Supabase sorgularını bellek + sessionStorage'da cache'ler.
 * - TTL: 5 dakika (default)
 * - Explicit 'force' parametresiyle bypass edilebilir
 * - sessionStorage: sekme kapanınca temizlenir, sayfa yenilemede kalır
 */

const MEMORY = new Map(); // Aynı oturum içi hızlı cache
const TTL_MS = 5 * 60 * 1000; // 5 dakika

function cacheKey(key) {
  return `aERP_cache_${key}`;
}

function get(key) {
  // Önce memory
  if (MEMORY.has(key)) {
    const { data, ts } = MEMORY.get(key);
    if (Date.now() - ts < TTL_MS) return data;
    MEMORY.delete(key);
  }
  // sessionStorage
  try {
    const raw = sessionStorage.getItem(cacheKey(key));
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < TTL_MS) {
        MEMORY.set(key, { data, ts }); // memory'e de al
        return data;
      }
      sessionStorage.removeItem(cacheKey(key));
    }
  } catch { /* noop */ }
  return null;
}

function set(key, data) {
  const entry = { data, ts: Date.now() };
  MEMORY.set(key, entry);
  try {
    sessionStorage.setItem(cacheKey(key), JSON.stringify(entry));
  } catch { /* storage dolu olabilir */ }
}

function invalidate(key) {
  MEMORY.delete(key);
  try { sessionStorage.removeItem(cacheKey(key)); } catch { /* noop */ }
}

function invalidateAll() {
  MEMORY.clear();
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('aERP_cache_'))
      .forEach(k => sessionStorage.removeItem(k));
  } catch { /* noop */ }
}

/**
 * Cached Supabase query helper.
 * @param {string} key - Benzersiz cache anahtarı
 * @param {Function} queryFn - async () => ({ data, error }) döndüren fonksiyon
 * @param {boolean} force - true ise cache'i bypass eder ve yeniler
 */
async function cachedQuery(key, queryFn, force = false) {
  if (!force) {
    const cached = get(key);
    if (cached !== null) return { data: cached, fromCache: true };
  }
  const { data, error } = await queryFn();
  if (!error && data) set(key, data);
  return { data, error, fromCache: false };
}

export const pageCache = { get, set, invalidate, invalidateAll, cachedQuery };
