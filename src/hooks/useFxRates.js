/**
 * useFxRates — Tüm kurları (USD, EUR, GBP) bir kerede çeken,
 * 5 dakika boyunca önbellekte tutan paylaşımlı hook.
 *
 * Fallback: API hata verirse app_settings'deki varsayılan kurlar kullanılır.
 * Her başarılı çekimde app_settings güncellenir.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const CURRENCIES = ['USD', 'EUR', 'GBP'];
const CACHE_TTL  = 5 * 60 * 1000; // 5 dakika
const FALLBACK_SETTINGS_KEY = 'default_fx_rates';

// Modül düzeyinde önbellek — sayfa yenilenmeden paylaşılır
const cache = {
  data: {},       // { 'YYYY-MM-DD': { USD: n, EUR: n, GBP: n } }
  ts:   {},       // { 'YYYY-MM-DD': timestamp }
};

// Fallback kurları Supabase'den çek
async function loadFallbackRates() {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', FALLBACK_SETTINGS_KEY)
      .maybeSingle();
    return data?.value || { USD: 38.50, EUR: 42.00, GBP: 49.00 };
  } catch {
    return { USD: 38.50, EUR: 42.00, GBP: 49.00 };
  }
}

// Başarılı kur çekiminde fallback'i güncelle
async function saveFallbackRates(rates) {
  try {
    await supabase.from('app_settings').upsert({
      id: FALLBACK_SETTINGS_KEY,
      value: { ...rates, _updated: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
  } catch { /* sessizce geç */ }
}

async function fetchRatesForDate(dateStr) {
  const now = Date.now();
  // Önbellekte taze veri var mı?
  if (cache.data[dateStr] && (now - (cache.ts[dateStr] || 0)) < CACHE_TTL) {
    return { rates: cache.data[dateStr], fromFallback: false };
  }

  const results = await Promise.allSettled(
    CURRENCIES.map(async (curr) => {
      const qs = new URLSearchParams({ currency: curr });
      if (dateStr) qs.append('date', dateStr);
      const res = await fetch(`/api/exchange-rate?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'API error');
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
    // Başarılı çekimde fallback'i güncelle
    saveFallbackRates(map);
    return { rates: map, fromFallback: false };
  }

  // API'den hiç veri gelmedi → fallback kullan
  const fallback = await loadFallbackRates();
  console.warn('[useFxRates] API başarısız, fallback kurlar kullanılıyor:', fallback);
  cache.data[dateStr] = fallback;
  cache.ts[dateStr]   = now;
  return { rates: fallback, fromFallback: true };
}

/**
 * @param {{ currency?: string, date?: string, enabled?: boolean }} options
 */
export function useFxRates({ currency = 'TRY', date = '', enabled = true } = {}) {
  const [fxRates, setFxRates]         = useState({});
  const [loadingRates, setLoading]    = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const dateKey = date || today;

  const loadRates = useCallback(async (forceDate) => {
    setLoading(true);
    try {
      const { rates, fromFallback } = await fetchRatesForDate(forceDate || dateKey);
      setFxRates(rates);
      setUsingFallback(fromFallback);
    } catch (e) {
      console.warn('[useFxRates] Kur çekme hatası:', e.message);
      // Son çare: hardcoded fallback
      const fallback = await loadFallbackRates();
      setFxRates(fallback);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    if (!enabled) return;
    loadRates(dateKey);
  }, [enabled, dateKey]);

  // Seçili currency için exchangeRate türet
  const exchangeRate = fxRates[currency]
    ? { rate: fxRates[currency], source: usingFallback ? 'fallback' : 'tcmb' }
    : null;

  const refreshRates = useCallback(() => {
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

  return { fxRates, exchangeRate, loadingRates, refreshRates, convert, usingFallback };
}

// Export for external use (Settings page)
export { loadFallbackRates, saveFallbackRates, FALLBACK_SETTINGS_KEY };
