-- =====================================================================
-- diagnose_raw_detail.sql
-- Faturlardaki raw_detail JSON yapısını incele
-- Supabase > SQL Editor'de çalıştır
-- =====================================================================

-- 1. raw_detail'in üst seviye key'lerini göster (ilk 5 fatura)
SELECT
  invoice_id,
  type,
  cari_name,
  cari_tax_office,
  jsonb_object_keys(raw_detail) AS top_keys
FROM invoices
WHERE raw_detail IS NOT NULL
LIMIT 30;

---Sonuç---
[
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "ID"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "Note"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "UUID"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "TaxTotal"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "IssueDate"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "IssueTime"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "ProfileID"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "Signature"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "attributes"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "InvoiceLine"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "UBLVersionID"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "CopyIndicator"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "UBLExtensions"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "AllowanceCharge"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "CustomizationID"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "InvoiceTypeCode"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "LineCountNumeric"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "LegalMonetaryTotal"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "DocumentCurrencyCode"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "AccountingCustomerParty"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "AccountingSupplierParty"
  },
  {
    "invoice_id": "BL02025000000186",
    "type": "inbox",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "top_keys": "AdditionalDocumentReference"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "ID"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "Note"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "UUID"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "TaxTotal"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "IssueDate"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "IssueTime"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "ProfileID"
  },
  {
    "invoice_id": "OTM2026000002382",
    "type": "inbox",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "top_keys": "Signature"
  }
]


-- 2. Belirli bir faturada vergi dairesi bilgisini bul
-- (AccountingSupplierParty veya cac: prefix'li olabilir)
SELECT
  invoice_id,
  cari_name,
  cari_tax_office,
  -- Duz path denemesi:
  raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PartyTaxScheme' ->> 'RegistrationName' AS supplier_taxoffice_direct,
  raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PartyTaxScheme' ->> 'RegistrationName' AS customer_taxoffice_direct,
  -- TaxScheme.Name denemesi:
  raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PartyTaxScheme' -> 'TaxScheme' ->> 'Name' AS supplier_taxscheme_name,
  raw_detail -> 'AccountingCustomerParty' -> 'Party' -> 'PartyTaxScheme' -> 'TaxScheme' ->> 'Name' AS customer_taxscheme_name,
  -- Tek seviye Party olmadan:
  raw_detail -> 'AccountingSupplierParty' -> 'PartyTaxScheme' ->> 'RegistrationName' AS supplier_noparty,
  raw_detail -> 'AccountingCustomerParty' -> 'PartyTaxScheme' ->> 'RegistrationName' AS customer_noparty,
  -- City kontrol:
  raw_detail -> 'AccountingSupplierParty' -> 'Party' -> 'PostalAddress' ->> 'CityName' AS supplier_city_direct,
  raw_detail -> 'AccountingSupplierParty' -> 'PostalAddress' ->> 'CityName' AS supplier_city_noparty,
  -- Full Party node tipini gör:
  jsonb_typeof(raw_detail -> 'AccountingSupplierParty') AS supplier_type,
  jsonb_typeof(raw_detail -> 'AccountingSupplierParty' -> 'Party') AS supplier_party_type
FROM invoices
WHERE raw_detail IS NOT NULL
LIMIT 5;

---Sonuç---
[
  {
    "invoice_id": "BL02025000000186",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "supplier_taxoffice_direct": null,
    "customer_taxoffice_direct": null,
    "supplier_taxscheme_name": "Beyoğlu",
    "customer_taxscheme_name": "BORNOVA",
    "supplier_noparty": null,
    "customer_noparty": null,
    "supplier_city_direct": "İSTANBUL",
    "supplier_city_noparty": null,
    "supplier_type": "object",
    "supplier_party_type": "object"
  },
  {
    "invoice_id": "OTM2026000002382",
    "cari_name": "OTOMAT ALÜMİNYUM İNŞAAT SAN. VE TİC. LTD.ŞTİ.",
    "cari_tax_office": null,
    "supplier_taxoffice_direct": null,
    "customer_taxoffice_direct": null,
    "supplier_taxscheme_name": "İZMİR İHTİSAS",
    "customer_taxscheme_name": "BORNOVA",
    "supplier_noparty": null,
    "customer_noparty": null,
    "supplier_city_direct": "IZMIR",
    "supplier_city_noparty": null,
    "supplier_type": "object",
    "supplier_party_type": "object"
  },
  {
    "invoice_id": "FT12026000000800",
    "cari_name": "BLT İZMİR EKSPRES TAŞIMACILIK TİCARET LİMİTED ŞİRKETİ",
    "cari_tax_office": null,
    "supplier_taxoffice_direct": null,
    "customer_taxoffice_direct": null,
    "supplier_taxscheme_name": "HASAN TAHSİN",
    "customer_taxscheme_name": "BORNOVA",
    "supplier_noparty": null,
    "customer_noparty": null,
    "supplier_city_direct": "İZMİR",
    "supplier_city_noparty": null,
    "supplier_type": "object",
    "supplier_party_type": "object"
  },
  {
    "invoice_id": "NEA2025000007864",
    "cari_name": "Nokta Elektronik ve Bilişim Sistemleri San. Tic. A.Ş.",
    "cari_tax_office": null,
    "supplier_taxoffice_direct": null,
    "customer_taxoffice_direct": null,
    "supplier_taxscheme_name": "Şişli",
    "customer_taxscheme_name": "Bornova",
    "supplier_noparty": null,
    "customer_noparty": null,
    "supplier_city_direct": "İstanbul",
    "supplier_city_noparty": null,
    "supplier_type": "object",
    "supplier_party_type": "object"
  },
  {
    "invoice_id": "SEV2025000000675",
    "cari_name": "SEVA AYDINLATMA ENERJİ TAAHHÜT SAN.VE TİC.A.Ş.",
    "cari_tax_office": null,
    "supplier_taxoffice_direct": null,
    "customer_taxoffice_direct": null,
    "supplier_taxscheme_name": "EGE VERGİ DAİRESİ MÜDÜRLÜĞÜ",
    "customer_taxscheme_name": "BORNOVA VERGİ DAİRESİ MÜDÜRLÜĞÜ",
    "supplier_noparty": null,
    "customer_noparty": null,
    "supplier_city_direct": "İZMİR",
    "supplier_city_noparty": null,
    "supplier_type": "object",
    "supplier_party_type": "object"
  }
]

-- 3. AccountingSupplierParty içeriğini tamamen göster (ilk fatura)
SELECT
  invoice_id,
  cari_name,
  raw_detail -> 'AccountingSupplierParty' AS full_supplier_node
FROM invoices
WHERE raw_detail IS NOT NULL
  AND raw_detail -> 'AccountingSupplierParty' IS NOT NULL
LIMIT 1;

---Sonuç---
[
  {
    "invoice_id": "BL02025000000186",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "full_supplier_node": {
      "Party": {
        "Contact": {
          "Telephone": "0 (212) 570 19 85",
          "ElectronicMail": "bulled@bulledaydinlatma.com"
        },
        "PartyName": {
          "Name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ"
        },
        "PostalAddress": {
          "Country": {
            "Name": "Türkiye"
          },
          "CityName": "İSTANBUL",
          "StreetName": "Emekyemez Mah. Tenha Sok.  9 / 5 Beyoğlu İstanbul 34421",
          "CitySubdivisionName": "Beyoğlu"
        },
        "PartyTaxScheme": {
          "TaxScheme": {
            "Name": "Beyoğlu"
          }
        },
        "PartyIdentification": [
          {
            "ID": {
              "$value": "1891397409",
              "attributes": {
                "schemeID": "VKN"
              }
            }
          }
        ]
      }
    }
  }
]

-- 4. AccountingCustomerParty içeriğini tamamen göster (ilk fatura)
SELECT
  invoice_id,
  cari_name,
  raw_detail -> 'AccountingCustomerParty' AS full_customer_node
FROM invoices
WHERE raw_detail IS NOT NULL
  AND raw_detail -> 'AccountingCustomerParty' IS NOT NULL
LIMIT 1;

---Sonuç---

[
  {
    "invoice_id": "BL02025000000186",
    "cari_name": "BULLED AYDINLATMA DIŞ TİCARET LİMİTED ŞİRKETİ",
    "full_customer_node": {
      "Party": {
        "PartyName": {
          "Name": "AYSA LED AYDINLATMA GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ"
        },
        "PostalAddress": {
          "Country": {
            "Name": "Türkiye"
          },
          "CityName": "İzmir",
          "StreetName": "OSMANGAZİ MAH. İBRAHİM ETHEM CAD. NO: 75 A",
          "CitySubdivisionName": "Bayraklı"
        },
        "PartyTaxScheme": {
          "TaxScheme": {
            "Name": "BORNOVA"
          }
        },
        "PartyIdentification": [
          {
            "ID": {
              "$value": "1231009459",
              "attributes": {
                "schemeID": "VKN"
              }
            }
          }
        ]
      }
    }
  }
]