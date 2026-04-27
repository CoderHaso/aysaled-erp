export default async function handler(req, res) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const url = \\://\System.Management.Automation.Internal.Host.InternalHost/api/sync-invoices\;
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'outbox', detailLimit: 50 }) });
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'inbox', detailLimit: 50 }) });
    res.json({ success: true, message: 'Cron sync completed' });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
}