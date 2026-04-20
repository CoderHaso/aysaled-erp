-- ═══════════════════════════════════════════════════════════════════
-- Satış anında maliyet kaydı için order_items'a yeni alan ekleme
-- cost_at_sale: Satış anındaki birim maliyet (TRY cinsinden)
-- cost_currency: Orijinal maliyet döviz cinsi
-- cost_details: JSONB — reçete detayı (hammadde fiyatları snapshot)
-- ═══════════════════════════════════════════════════════════════════

-- Birim maliyet (TRY'ye çevrilmiş, satış anında kaydedilen)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC DEFAULT 0;

-- Orijinal maliyet döviz cinsi
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'TRY';

-- Reçeteli ürünlerde hammadde maliyet detayı (snapshot)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_details JSONB DEFAULT NULL;

-- İndeks
CREATE INDEX IF NOT EXISTS idx_order_items_cost ON order_items (cost_at_sale) WHERE cost_at_sale > 0;
