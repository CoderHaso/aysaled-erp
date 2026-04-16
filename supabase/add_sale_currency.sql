-- Alış ve satış fiyatları artık bağımsız para birimlerine sahip olabilir
-- base_currency → purchase_currency (alış para birimi) olarak kalır
-- sale_currency  → yeni sütun (satış para birimi), başlangıçta base_currency'den alır

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS sale_currency text NOT NULL DEFAULT 'TRY';

-- Mevcut kayıtlar için: alış dövizliyse satışı da aynı dövize ayarla
UPDATE items
  SET sale_currency = base_currency
  WHERE sale_currency = 'TRY' AND base_currency IS NOT NULL;
