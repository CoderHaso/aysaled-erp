/**
 * useFxRates — Tüm kurları (USD, EUR, GBP) bir kerede çeken,
 * 5 dakika boyunca önbellekte tutan paylaşımlı hook.
 *
 * Kullanım:
 *   const { fxRates, exchangeRate, loadingRates } = useFxRates({ currency, date });
 *
 * fxRates         → { USD: 38.5, EUR: 42.1, GBP: 49.0 }  (her zaman dolu gelir)
 * exchangeRate    → seçili para birimi için { rate, source }  (TRY ise null)
 * loadingRates    → boolean
 * refreshRates()  → manuel yenileme (önbelleği bypass eder)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const CURRENCIES = ['USD', 'EUR', 'GBP'];
const CACHE_TTL  = 5 * 60 * 1000; // 5 dakika

// Modül düzeyinde önbellek — sayfa yenilenmeden paylaşılır
const cache = {
  data: {},       // { 'YYYY-MM-DD': { USD: n, EUR: n, GBP: n } }
  ts:   {},       // { 'YYYY-MM-DD': timestamp }
};

async function fetchRatesForDate(dateStr) {
  const now = Date.now();
  // Önbellekte taze veri var mı?
  if (cache.data[dateStr] && (now - (cache.ts[dateStr] || 0)) < CACHE_TTL) {
    return cache.data[dateStr];
  }

  const results = await Promise.allSettled(
    CURRENCIES.map(async (curr) => {
      const qs = new URLSearchParams({ currency: curr });
      if (dateStr) qs.append('date', dateStr);
      const res = await fetch(`/api/exchange-rate?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { curr, rate: data?.rate || null };
    })
  );

  const map = {};
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value?.rate) {
      map[r.value.curr] = r.value.rate;
    }
  });

  if (Object.keys(map).length > 0) {
    cache.data[dateStr] = map;
    cache.ts[dateStr]   = now;
  }

  return map;
}

/**
 * @param {{ currency?: string, date?: string, enabled?: boolean }} options
 *   - currency : seçili para birimi ('TRY', 'USD', 'EUR', 'GBP')
 *   - date     : YYYY-MM-DD tarih (opsiyonel, bugün kullanılır)
 *   - enabled  : false gönderilirse hiç fetch yapmaz (default: true)
 */
export function useFxRates({ currency = 'TRY', date = '', enabled = true } = {}) {
  const [fxRates, setFxRates]         = useState({});
  const [loadingRates, setLoading]    = useState(false);
  const didFetchRef = useRef(false);

  const today = new Date().toISOString().slice(0, 10);
  const dateKey = date || today;

  const loadRates = useCallback(async (forceDate) => {
    setLoading(true);
    try {
      const map = await fetchRatesForDate(forceDate || dateKey);
      setFxRates(map);
    } catch (e) {
      console.warn('[useFxRates] Kur çekme hatası:', e.message);
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  // Modal açılır açılmaz (enabled=true olduğu anda) ilk fetch
  useEffect(() => {
    if (!enabled) return;
    loadRates(dateKey);
  }, [enabled, dateKey]);  // dateKey değişirse (tarih seçilince) yeniler

  // Seçili currency için exchangeRate türet
  const exchangeRate = fxRates[currency]
    ? { rate: fxRates[currency], source: 'tcmb' }
    : null;

  const refreshRates = useCallback(() => {
    // Önbelleği geçersiz kıl ve yenile
    cache.ts[dateKey] = 0;
    loadRates(dateKey);
  }, [dateKey, loadRates]);

  const convert = useCallback((amount, fromCur, toCur) => {
    if (!amount) return 0;
    if (fromCur === toCur) return amount;
    
    // convert to TRY first (local base)
    let valInTry = amount;
    if (fromCur !== 'TRY') {
      const rate = fxRates[fromCur] || 1; 
      valInTry = amount * rate;
    }
    
    // convert from TRY to target currency
    if (toCur === 'TRY') return valInTry;
    const toRate = fxRates[toCur] || 1;
    return valInTry / toRate;
  }, [fxRates]);

  return { fxRates, exchangeRate, loadingRates, refreshRates, convert };
}
