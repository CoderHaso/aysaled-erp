import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

/**
 * GenerateDocumentUrl API çağrısı ile fatura HTML/PDF URL'i döner.
 * POST body: { documentId, documentType, fileType }
 * documentType: 'OutboxInvoice' | 'InboxInvoice'
 * fileType: 'Html' | 'Pdf' | 'All'
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    documentId,
    documentType = 'OutboxInvoice', // OutboxInvoice | InboxInvoice
    fileType      = 'Html',          // Html | Pdf | All
  } = req.body || {};

  if (!documentId) return res.status(400).json({ error: 'documentId gerekli' });

  try {
    const client = await createUyumsoftClient();

    const result = await callSoap(client, 'GenerateDocumentUrl', {
      documentAccessInfo: {
        DocumentId:       documentId,
        DocumentType:     documentType,
        AllowedFileTypes: 'Html',
        FileType:         fileType,
      },
    });

    const r = result?.GenerateDocumentUrlResult;
    const ok = String(r?.attributes?.IsSucceded).toLowerCase() === 'true';

    if (!ok) {
      return res.status(400).json({
        success: false,
        error: r?.attributes?.Message || 'URL üretilemedi',
      });
    }

    // Message alanı URL içeriyor
    const url = r?.attributes?.Message || r?.Message || '';

    return res.json({ success: true, url, fileType });
  } catch (err) {
    console.error('[get-invoice-url]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
