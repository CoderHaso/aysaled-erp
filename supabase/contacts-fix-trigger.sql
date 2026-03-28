-- =====================================================================
-- contacts-fix-trigger.sql
-- Trigger'ı raw_detail'den okuyacak şekilde günceller
-- (raw_data listeden gelir, adres yoktur; raw_detail tam UBL'dir)
-- Supabase > SQL Editor'de çalıştırın
-- =====================================================================

CREATE OR REPLACE FUNCTION sync_contact_from_invoice()
RETURNS trigger AS $$
DECLARE
  v_raw        jsonb;
  v_party      jsonb;
  v_addr       jsonb;
  v_contact    jsonb;
  v_tax        jsonb;
  v_phone      text;
  v_email      text;
  v_address    text;
  v_city       text;
  v_postal     text;
  v_tax_office text;
BEGIN
  IF NEW.vkntckn IS NULL OR NEW.vkntckn = '' THEN
    RETURN NEW;
  END IF;

  -- raw_detail'den dene (tam UBL), yoksa raw_data'ya dön
  v_raw := COALESCE(NEW.raw_detail, NEW.raw_data);

  -- Karşı taraf partisi:
  -- inbox (gelen) → biz alıcıyız → karşı taraf = Supplier
  -- outbox (giden) → biz satıcıyız → karşı taraf = Customer
  IF NEW.type = 'inbox' THEN
    v_party := COALESCE(
      v_raw -> 'AccountingSupplierParty' -> 'Party',
      v_raw -> 'AccountingSupplierParty'
    );
  ELSE
    v_party := COALESCE(
      v_raw -> 'AccountingCustomerParty' -> 'Party',
      v_raw -> 'AccountingCustomerParty'
    );
  END IF;

  -- PostalAddress
  v_addr := COALESCE(v_party -> 'PostalAddress', v_party -> 'Address');

  -- Şehir
  v_city := COALESCE(
    v_addr ->> 'CityName',
    v_addr -> 'CityName' ->> '_',
    v_addr ->> 'CitySubdivisionName',
    v_addr -> 'CitySubdivisionName' ->> '_'
  );

  -- Posta kodu
  v_postal := COALESCE(v_addr ->> 'PostalZone', v_addr ->> 'PostalCode');

  -- Sokak adresi
  v_address := trim(concat_ws(' ',
    NULLIF(COALESCE(v_addr ->> 'StreetName',    v_addr -> 'StreetName' ->> '_'), ''),
    NULLIF(COALESCE(v_addr ->> 'BuildingNumber', v_addr -> 'BuildingNumber' ->> '_'), ''),
    NULLIF(COALESCE(v_addr ->> 'BuildingName',   v_addr -> 'BuildingName' ->> '_'), '')
  ));
  IF v_address = '' THEN v_address := NULL; END IF;

  -- Vergi dairesi
  v_tax := COALESCE(v_party -> 'PartyTaxScheme', NULL);
  v_tax_office := COALESCE(
    v_tax ->> 'RegistrationName',
    v_tax -> 'RegistrationName' ->> '_'
  );

  -- İletişim
  v_contact := v_party -> 'Contact';
  v_phone := COALESCE(
    v_contact ->> 'Telephone',
    v_contact -> 'Telephone' ->> '_',
    v_contact ->> 'Telefax',
    v_contact -> 'Telefax' ->> '_'
  );
  v_email := COALESCE(
    v_contact ->> 'ElectronicMail',
    v_contact -> 'ElectronicMail' ->> '_'
  );

  -- UPSERT: sadece dolu değerleri yaz, manuel girilenlerin üstüne yazma
  IF NEW.type = 'inbox' THEN
    INSERT INTO customers (
      name, vkntckn, phone, email, address, city, postal_code, tax_office, source, updated_at
    ) VALUES (
      NEW.cari_name, NEW.vkntckn,
      v_phone, v_email, v_address, v_city, v_postal, v_tax_office,
      'invoice_sync', now()
    )
    ON CONFLICT (vkntckn) DO UPDATE
      SET name       = EXCLUDED.name,
          phone      = COALESCE(NULLIF(EXCLUDED.phone,      ''), customers.phone),
          email      = COALESCE(NULLIF(EXCLUDED.email,      ''), customers.email),
          address    = COALESCE(NULLIF(EXCLUDED.address,    ''), customers.address),
          city       = COALESCE(NULLIF(EXCLUDED.city,       ''), customers.city),
          postal_code= COALESCE(NULLIF(EXCLUDED.postal_code,''), customers.postal_code),
          tax_office = COALESCE(NULLIF(EXCLUDED.tax_office, ''), customers.tax_office),
          source     = 'invoice_sync',
          updated_at = now();
  END IF;

  IF NEW.type = 'outbox' THEN
    INSERT INTO suppliers (
      name, vkntckn, phone, email, address, city, postal_code, tax_office, source, updated_at
    ) VALUES (
      NEW.cari_name, NEW.vkntckn,
      v_phone, v_email, v_address, v_city, v_postal, v_tax_office,
      'invoice_sync', now()
    )
    ON CONFLICT (vkntckn) DO UPDATE
      SET name       = EXCLUDED.name,
          phone      = COALESCE(NULLIF(EXCLUDED.phone,      ''), suppliers.phone),
          email      = COALESCE(NULLIF(EXCLUDED.email,      ''), suppliers.email),
          address    = COALESCE(NULLIF(EXCLUDED.address,    ''), suppliers.address),
          city       = COALESCE(NULLIF(EXCLUDED.city,       ''), suppliers.city),
          postal_code= COALESCE(NULLIF(EXCLUDED.postal_code,''), suppliers.postal_code),
          tax_office = COALESCE(NULLIF(EXCLUDED.tax_office, ''), suppliers.tax_office),
          source     = 'invoice_sync',
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contact ON invoices;
CREATE TRIGGER trg_sync_contact
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_contact_from_invoice();

-- Mevcut raw_detail'i olan tüm faturalar için trigger'ı yeniden tetikle
UPDATE invoices
SET updated_at = now()
WHERE vkntckn IS NOT NULL AND vkntckn <> '';
