-- ============================================================
-- 5d. Eksik kolonlar: building_number, is_faturasiz, tax_office
-- customers ve suppliers tablolarına
-- ============================================================

-- customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS building_number  text,
  ADD COLUMN IF NOT EXISTS is_faturasiz     boolean DEFAULT false;

-- suppliers: tax_id kolonu YOK, gerçek kolon adı tax_office
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS tax_office       text,
  ADD COLUMN IF NOT EXISTS building_number  text,
  ADD COLUMN IF NOT EXISTS is_faturasiz     boolean DEFAULT false;

-- Kontrol
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('customers', 'suppliers')
  AND column_name IN ('tax_office', 'building_number', 'is_faturasiz', 'district', 'country', 'postal_code')
ORDER BY table_name, column_name;
