import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

/**
 * Sipariş formundan gelen verileri Uyumsoft'a "Draft" olarak kaydeder,
 * ardından GenerateDocumentUrl ile HTML önizleme URL'i döner.
 *
 * POST body:
 * {
 *   customerName, customerVkntckn,
 *   currency, invoiceDate,
 *   lines: [{ name, quantity, unit, unitPrice, taxRate }],
 *   notes
 * }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { customerName, customerVkntckn, currency = 'TRY', invoiceDate, lines = [], notes } = req.body || {};

  if (!customerName || lines.length === 0) {
    return res.status(400).json({ error: 'customerName ve lines zorunlu' });
  }

  const today = invoiceDate || new Date().toISOString().slice(0, 10);

  // UBL InvoiceLine[] dizisi oluştur
  const invoiceLines = lines.map((l, idx) => {
    const lineTotal  = (l.quantity || 0) * (l.unitPrice || 0);
    const taxAmount  = lineTotal * (l.taxRate || 0) / 100;
    return {
      ID: String(idx + 1),
      Item: { Name: l.name || 'Ürün' },
      InvoicedQuantity: { _: String(l.quantity || 1), attributes: { unitCode: l.unit || 'NIU' } },
      LineExtensionAmount: { _: lineTotal.toFixed(2), attributes: { currencyID: currency } },
      Price: {
        PriceAmount: { _: (l.unitPrice || 0).toFixed(2), attributes: { currencyID: currency } },
      },
      TaxTotal: {
        TaxAmount:    { _: taxAmount.toFixed(2), attributes: { currencyID: currency } },
        TaxSubtotal: {
          TaxableAmount: { _: lineTotal.toFixed(2), attributes: { currencyID: currency } },
          TaxAmount:     { _: taxAmount.toFixed(2), attributes: { currencyID: currency } },
          TaxCategory: {
            TaxScheme: { Name: 'KDV' },
            Percent: String(l.taxRate || 0),
          },
        },
      },
    };
  });

  const subtotal   = lines.reduce((s, l) => s + (l.quantity||0) * (l.unitPrice||0), 0);
  const taxTotal   = lines.reduce((s, l) => s + (l.quantity||0) * (l.unitPrice||0) * (l.taxRate||0) / 100, 0);
  const grandTotal = subtotal + taxTotal;

  // Minimal UBL Invoice nesnesi — Uyumsoft SaveAsDraft için
  const invoice = {
    ID:                   `TASLAK-${Date.now()}`,
    IssueDate:            today,
    InvoiceTypeCode:      'SATIS',
    DocumentCurrencyCode: currency,
    Note:                 notes || '',
    AccountingCustomerParty: {
      Party: {
        PartyName: { Name: customerName },
        PartyTaxScheme: {
          RegistrationName: customerName,
          CompanyID: customerVkntckn || '',
          TaxScheme: { Name: 'VKN' },
        },
      },
    },
    TaxTotal: {
      TaxAmount: { _: taxTotal.toFixed(2), attributes: { currencyID: currency } },
    },
    LegalMonetaryTotal: {
      LineExtensionAmount: { _: subtotal.toFixed(2),   attributes: { currencyID: currency } },
      TaxExclusiveAmount:  { _: subtotal.toFixed(2),   attributes: { currencyID: currency } },
      TaxInclusiveAmount:  { _: grandTotal.toFixed(2), attributes: { currencyID: currency } },
      PayableAmount:       { _: grandTotal.toFixed(2), attributes: { currencyID: currency } },
    },
    'InvoiceLine[]': invoiceLines,
  };

  try {
    const client = await createUyumsoftClient();

    // 1) Taslak kaydet
    const saveResult = await callSoap(client, 'SaveAsDraft', {
      invoices: [{ Invoice: invoice }],
    });

    const savedInvoices = saveResult?.SaveAsDraftResult?.Value
      || saveResult?.SaveAsDraftResult?.['Value[]']
      || [];
    const firstSaved = Array.isArray(savedInvoices) ? savedInvoices[0] : savedInvoices;
    const documentId = firstSaved?.InvoiceId || firstSaved?.DocumentId;

    if (!documentId) {
      const msg = saveResult?.SaveAsDraftResult?.attributes?.Message || 'Taslak kaydedilemedi';
      return res.status(400).json({ success: false, error: msg, raw: saveResult });
    }

    // 2) HTML önizleme URL'i üret
    const urlResult = await callSoap(client, 'GenerateDocumentUrl', {
      documentAccessInfo: {
        DocumentId:       documentId,
        DocumentType:     'OutboxInvoice',
        AllowedFileTypes: 'Html',
        FileType:         'Html',
      },
    });

    const ur  = urlResult?.GenerateDocumentUrlResult;
    const url = ur?.attributes?.Message || ur?.Message || '';

    // 3) Taslağı iptal et (iç sipariş kaydı amacıyla kullanıldı, gerçek fatura değil)
    try {
      await callSoap(client, 'CancelDraft', {
        invoiceIds: { 'string[]': documentId },
      });
    } catch (_) { /* iptal başarısız olursa sorun değil */ }

    return res.json({ success: true, documentId, previewUrl: url });

  } catch (err) {
    console.error('[draft-invoice-preview]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
