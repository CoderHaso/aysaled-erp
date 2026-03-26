import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { vkn } = req.body || {};
  if (!vkn) return res.status(400).json({ error: 'VKN zorunlu' });

  try {
    const client = await createUyumsoftClient();
    // Uyumsoft'un kullanıcı sorgulama metoduna göre güncelle
    const result = await callSoap(client, 'CheckUserStatus', { taxId: vkn });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[check-user]', err.message);
    res.status(500).json({ error: 'Kullanıcı sorgulanamadı', detail: err.message });
  }
}
