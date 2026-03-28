-- =====================================================================
-- contacts-enriched-update.sql
-- Customers/Suppliers tablolarına ek kolon ekler + trigger'ı günceller
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

-- ── 1. Ek kolonlar (idempotent) ───────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_person  text,
  ADD COLUMN IF NOT EXISTS country         text DEFAULT 'Türkiye',
  ADD COLUMN IF NOT EXISTS postal_code     text,
  ADD COLUMN IF NOT EXISTS website         text,
  ADD COLUMN IF NOT EXISTS mersis_no       text;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_person  text,
  ADD COLUMN IF NOT EXISTS country         text DEFAULT 'Türkiye',
  ADD COLUMN IF NOT EXISTS postal_code     text,
  ADD COLUMN IF NOT EXISTS website         text,
  ADD COLUMN IF NOT EXISTS mersis_no       text;

-- ── 2. Zenginleştirilmiş trigger fonksiyonu ───────────────────────────
-- raw_data içindeki AccountingCustomerParty / AccountingSupplierParty
-- alanlarından adres, telefon, e-posta çeker.
CREATE OR REPLACE FUNCTION sync_contact_from_invoice()
RETURNS trigger AS $$
DECLARE
  v_raw        jsonb;
  v_party      jsonb;
  v_addr       jsonb;
  v_contact    jsonb;
  v_phone      text;
  v_email      text;
  v_address    text;
  v_city       text;
  v_postal     text;
  v_country    text;
  v_person     text;
BEGIN
  IF NEW.vkntckn IS NULL OR NEW.vkntckn = '' THEN
    RETURN NEW;
  END IF;

  -- ham veriyi al
  v_raw := NEW.raw_data;

  -- ─── Alıcı (inbox=gelen=müşteri / outbox=giden=tedarikçi) ──────────
  IF NEW.type = 'inbox' THEN
    v_party := v_raw -> 'AccountingSupplierParty' -> 'Party';
  ELSE
    v_party := v_raw -> 'AccountingCustomerParty' -> 'Party';
  END IF;

  -- PostalAddress
  v_addr    := COALESCE(v_party -> 'PostalAddress', v_party -> 'Address');
  v_city    := COALESCE(
    v_addr ->> 'CityName',
    v_addr -> 'CitySubdivisionName' ->> '_',
    v_addr ->> 'CitySubdivisionName'
  );
  v_postal  := COALESCE(v_addr ->> 'PostalZone', v_addr ->> 'PostalCode');
  v_country := COALESCE(
    v_addr -> 'Country' -> 'Name' ->> '_',
    v_addr -> 'Country' ->> 'Name',
    'Türkiye'
  );
  -- Adres: StreetName + BuildingNumber + BuildingName
  v_address := trim(concat_ws(' ',
    NULLIF(v_addr ->> 'StreetName', ''),
    NULLIF(v_addr ->> 'BuildingNumber', ''),
    NULLIF(v_addr ->> 'BuildingName', '')
  ));
  IF v_address = '' THEN v_address := NULL; END IF;

  -- Contact
  v_contact := v_party -> 'Contact';
  v_phone   := COALESCE(
    v_contact ->> 'Telephone',
    v_contact ->> 'Telefax',
    (v_party -> 'PartyTelecom' ->> 'TelecommunicationsChannelCode')
  );
  v_email   := v_contact ->> 'ElectronicMail';
  v_person  := COALESCE(
    v_party -> 'Person' ->> 'FirstName',
    v_party -> 'Contact' ->> 'Name'
  );

  -- ─── UPSERT ────────────────────────────────────────────────────────
  IF NEW.type = 'inbox' THEN
    INSERT INTO customers (
      name, vkntckn, phone, email, address, city, postal_code, country,
      contact_person, source, updated_at
    ) VALUES (
      NEW.cari_name, NEW.vkntckn,
      v_phone, v_email, v_address, v_city, v_postal,
      COALESCE(v_country, 'Türkiye'),
      v_person, 'invoice_sync', now()
    )
    ON CONFLICT (vkntckn) DO UPDATE
      SET name           = EXCLUDED.name,
          phone          = COALESCE(EXCLUDED.phone,         customers.phone),
          email          = COALESCE(EXCLUDED.email,         customers.email),
          address        = COALESCE(EXCLUDED.address,       customers.address),
          city           = COALESCE(EXCLUDED.city,          customers.city),
          postal_code    = COALESCE(EXCLUDED.postal_code,   customers.postal_code),
          country        = COALESCE(EXCLUDED.country,       customers.country),
          contact_person = COALESCE(EXCLUDED.contact_person,customers.contact_person),
          source         = 'invoice_sync',
          updated_at     = now()
      WHERE customers.source = 'invoice_sync'
         OR customers.phone IS NULL
         OR customers.address IS NULL;
  END IF;

  IF NEW.type = 'outbox' THEN
    INSERT INTO suppliers (
      name, vkntckn, phone, email, address, city, postal_code, country,
      contact_person, source, updated_at
    ) VALUES (
      NEW.cari_name, NEW.vkntckn,
      v_phone, v_email, v_address, v_city, v_postal,
      COALESCE(v_country, 'Türkiye'),
      v_person, 'invoice_sync', now()
    )
    ON CONFLICT (vkntckn) DO UPDATE
      SET name           = EXCLUDED.name,
          phone          = COALESCE(EXCLUDED.phone,         suppliers.phone),
          email          = COALESCE(EXCLUDED.email,         suppliers.email),
          address        = COALESCE(EXCLUDED.address,       suppliers.address),
          city           = COALESCE(EXCLUDED.city,          suppliers.city),
          postal_code    = COALESCE(EXCLUDED.postal_code,   suppliers.postal_code),
          country        = COALESCE(EXCLUDED.country,       suppliers.country),
          contact_person = COALESCE(EXCLUDED.contact_person,suppliers.contact_person),
          source         = 'invoice_sync',
          updated_at     = now()
      WHERE suppliers.source = 'invoice_sync'
         OR suppliers.phone IS NULL
         OR suppliers.address IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contact ON invoices;
CREATE TRIGGER trg_sync_contact
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_contact_from_invoice();

-- ── 3. Mevcut kayıtları html_view kolonu ile güncelle (yoksa ekle) ────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS html_view text;

-- ── 4. Ek başlangıç bilgisi: raw_data varsa, mevcut customers/suppliers güncelle ──
-- (Bu sorgu raw_data'dan adres çekmeye çalışır, mevcut satırları tetikler)
UPDATE invoices SET updated_at = now()
WHERE raw_data IS NOT NULL
  AND vkntckn IS NOT NULL
  AND vkntckn <> '';
