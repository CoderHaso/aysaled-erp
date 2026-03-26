import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { invoiceData } = req.body || {};
  if (!invoiceData) return res.status(400).json({ error: 'invoiceData zorunlu' });

  try {
    const client = await createUyumsoftClient();
    const result = await callSoap(client, 'SaveAsDraft', { invoices: [invoiceData] });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[send-invoice]', err.message);
    res.status(500).json({ error: 'Fatura gönderilemedi', detail: err.message });
  }
}
