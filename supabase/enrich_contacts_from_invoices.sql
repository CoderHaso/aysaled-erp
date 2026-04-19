-- =====================================================================
-- enrich_contacts_from_invoices.sql
-- Mevcut suppliers & customers kayıtlarında NULL olan alanları,
-- invoices tablosundaki raw_detail'den doldurur.
-- Supabase > SQL Editor'de sırasıyla çalıştırın.
-- =====================================================================

-- ▸ ADIM 1: invoices tablosunda cari_* boş olan ama raw_detail dolu olan
-- faturaların cari_* sütunlarını raw_detail JSON'dan doldur.
-- Vergi dairesi: PartyTaxScheme -> TaxScheme -> Name (RegistrationName değil!)

UPDATE invoices inv SET
  cari_tax_office = COALESCE(
    inv.cari_tax_office,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PartyTaxScheme' -> 'TaxScheme' ->> 'Name',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PartyTaxScheme' -> 'TaxScheme' ->> 'Name'
  ),
  cari_address = COALESCE(
    inv.cari_address,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PostalAddress' ->> 'StreetName',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PostalAddress' ->> 'StreetName'
  ),
  cari_city = COALESCE(
    inv.cari_city,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PostalAddress' ->> 'CityName',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PostalAddress' ->> 'CityName'
  ),
  cari_district = COALESCE(
    inv.cari_district,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PostalAddress' ->> 'CitySubdivisionName',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PostalAddress' ->> 'CitySubdivisionName'
  ),
  cari_country = COALESCE(
    inv.cari_country,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PostalAddress' -> 'Country' ->> 'Name',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PostalAddress' -> 'Country' ->> 'Name'
  ),
  cari_phone = COALESCE(
    inv.cari_phone,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'Contact' ->> 'Telephone',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'Contact' ->> 'Telephone'
  ),
  cari_email = COALESCE(
    inv.cari_email,
    inv.raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'Contact' ->> 'ElectronicMail',
    inv.raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'Contact' ->> 'ElectronicMail'
  )
WHERE inv.raw_detail IS NOT NULL
  AND (
    inv.cari_tax_office IS NULL OR inv.cari_city IS NULL OR inv.cari_address IS NULL OR
    inv.cari_district IS NULL OR inv.cari_phone IS NULL OR inv.cari_email IS NULL
  );


-- ▸ ADIM 2: KONTROL — Hangi tedarikçilerin eksik alanları var?

SELECT
  s.name AS tedarikci,
  s.vkntckn,
  CASE WHEN s.tax_office IS NULL AND i.cari_tax_office IS NOT NULL THEN '❌→✅' ELSE '—' END AS vergi_dairesi,
  CASE WHEN s.address    IS NULL AND i.cari_address    IS NOT NULL THEN '❌→✅' ELSE '—' END AS adres,
  CASE WHEN s.city       IS NULL AND i.cari_city       IS NOT NULL THEN '❌→✅' ELSE '—' END AS il,
  CASE WHEN s.district   IS NULL AND i.cari_district   IS NOT NULL THEN '❌→✅' ELSE '—' END AS ilce,
  CASE WHEN s.country    IS NULL AND i.cari_country    IS NOT NULL THEN '❌→✅' ELSE '—' END AS ulke,
  CASE WHEN s.phone      IS NULL AND i.cari_phone      IS NOT NULL THEN '❌→✅' ELSE '—' END AS telefon,
  CASE WHEN s.email      IS NULL AND i.cari_email      IS NOT NULL THEN '❌→✅' ELSE '—' END AS eposta
FROM suppliers s
JOIN LATERAL (
  SELECT DISTINCT ON (inv2.vkntckn)
    inv2.cari_tax_office, inv2.cari_address, inv2.cari_city, inv2.cari_district,
    inv2.cari_country, inv2.cari_phone, inv2.cari_email
  FROM invoices inv2
  WHERE inv2.vkntckn = s.vkntckn
    AND inv2.vkntckn IS NOT NULL AND inv2.vkntckn <> ''
  ORDER BY inv2.vkntckn, inv2.issue_date DESC NULLS LAST
  LIMIT 1
) i ON true
WHERE s.vkntckn IS NOT NULL AND s.vkntckn <> ''
  AND (
    (s.tax_office IS NULL AND i.cari_tax_office IS NOT NULL) OR
    (s.address    IS NULL AND i.cari_address    IS NOT NULL) OR
    (s.city       IS NULL AND i.cari_city       IS NOT NULL) OR
    (s.district   IS NULL AND i.cari_district   IS NOT NULL) OR
    (s.country    IS NULL AND i.cari_country    IS NOT NULL) OR
    (s.phone      IS NULL AND i.cari_phone      IS NOT NULL) OR
    (s.email      IS NULL AND i.cari_email      IS NOT NULL)
  )
ORDER BY s.name;


-- ▸ ADIM 3: TEDARİKÇİLERİ ZENGİNLEŞTİR (kontrol sonrasında çalıştır)

UPDATE suppliers s
SET
  tax_office  = COALESCE(s.tax_office,  sub.cari_tax_office),
  address     = COALESCE(s.address,     sub.cari_address),
  city        = COALESCE(s.city,        sub.cari_city),
  district    = COALESCE(s.district,    sub.cari_district),
  country     = COALESCE(s.country,     sub.cari_country),
  phone       = COALESCE(s.phone,       sub.cari_phone),
  email       = COALESCE(s.email,       sub.cari_email),
  updated_at  = now()
FROM (
  SELECT DISTINCT ON (inv2.vkntckn)
    inv2.vkntckn,
    inv2.cari_tax_office, inv2.cari_address, inv2.cari_city, inv2.cari_district,
    inv2.cari_country, inv2.cari_phone, inv2.cari_email
  FROM invoices inv2
  WHERE inv2.vkntckn IS NOT NULL AND inv2.vkntckn <> ''
  ORDER BY inv2.vkntckn, inv2.issue_date DESC NULLS LAST
) sub
WHERE s.vkntckn = sub.vkntckn
  AND s.vkntckn IS NOT NULL AND s.vkntckn <> ''
  AND (
    s.tax_office IS NULL OR s.address IS NULL OR s.city IS NULL OR
    s.district IS NULL OR s.country IS NULL OR s.phone IS NULL OR s.email IS NULL
  );

-- MÜŞTERİLERİ ZENGİNLEŞTİR
UPDATE customers c
SET
  tax_office  = COALESCE(c.tax_office,  sub.cari_tax_office),
  address     = COALESCE(c.address,     sub.cari_address),
  city        = COALESCE(c.city,        sub.cari_city),
  district    = COALESCE(c.district,    sub.cari_district),
  country     = COALESCE(c.country,     sub.cari_country),
  phone       = COALESCE(c.phone,       sub.cari_phone),
  email       = COALESCE(c.email,       sub.cari_email),
  updated_at  = now()
FROM (
  SELECT DISTINCT ON (inv2.vkntckn)
    inv2.vkntckn,
    inv2.cari_tax_office, inv2.cari_address, inv2.cari_city, inv2.cari_district,
    inv2.cari_country, inv2.cari_phone, inv2.cari_email
  FROM invoices inv2
  WHERE inv2.vkntckn IS NOT NULL AND inv2.vkntckn <> ''
  ORDER BY inv2.vkntckn, inv2.issue_date DESC NULLS LAST
) sub
WHERE c.vkntckn = sub.vkntckn
  AND c.vkntckn IS NOT NULL AND c.vkntckn <> ''
  AND (
    c.tax_office IS NULL OR c.address IS NULL OR c.city IS NULL OR
    c.district IS NULL OR c.country IS NULL OR c.phone IS NULL OR c.email IS NULL
  );
