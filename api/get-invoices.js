import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { pageIndex = 0, pageSize = 20, startDate, endDate, status = 'Approved', type = 'inbox' } = req.body || {};

    const args = {
      query: {
        attributes: { PageIndex: pageIndex, PageSize: pageSize },
        CreateStartDate: startDate || '2026-01-01T00:00:00',
        CreateEndDate: endDate || new Date().toISOString().split('.')[0],
        Status: status,
        IsArchived: false,
      },
    };

    const client = await createUyumsoftClient();
    const methodName = type === 'outbox' ? 'GetOutboxInvoiceList' : 'GetInboxInvoiceList';
    const result = await callSoap(client, methodName, args);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[get-invoices]', err.message);
    res.status(500).json({ error: 'Fatura listesi çekilemedi', detail: err.message });
  }
}
