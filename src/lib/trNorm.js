/**
 * Türkçe karakter-duyarsız normalize: İ→i, I→ı, Ş→ş, vb.
 * Tüm arama/filtreleme işlemlerinde kullanılmalı.
 */
export const trNorm = (s) => (s || '')
  .toString()
  .toLocaleLowerCase('tr-TR')
  .replace(/İ/gi, 'i')
  .replace(/I/g, 'ı');
