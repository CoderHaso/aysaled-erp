/**
 * draft-invoice-preview.js
 *
 * Uyumsoft SaveAsDraft'ın UBL XML yapısı çok karmaşık olduğu için
 * form verilerinden client-side render edilecek profesyonel HTML fatura oluşturur.
 * Hiçbir Uyumsoft API çağrısı yapılmaz → hata riski sıfır.
 *
 * POST body: { customerName, customerVkntckn, customerAddress, customerCity,
 *              customerTaxOffice, currency, invoiceDate, lines, notes,
 *              companyName, companyVkntckn, companyAddress }
 * Response:  { success, html }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const {
    customerName, customerVkntckn = '', customerAddress = '', customerCity = '', customerTaxOffice = '',
    currency = 'TRY', invoiceDate, lines = [], notes = '',
    companyName = 'AYS LED', companyVkntckn = '', companyAddress = '', companyCity = '', companyTaxOffice = '',
  } = req.body || {};

  if (!customerName || lines.length === 0) {
    return res.status(400).json({ error: 'customerName ve lines zorunlu' });
  }

  const today = invoiceDate || new Date().toISOString().slice(0, 10);
  const sym   = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[currency] || '';
  const fmt   = (n) => `${sym}${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtD  = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const subtotal   = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const taxTotal   = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * (l.taxRate || 0) / 100, 0);
  const grandTotal = subtotal + taxTotal;

  // KDV dökümü
  const vatBreak = {};
  lines.forEach(l => {
    const pct = l.taxRate || 0;
    vatBreak[pct] = (vatBreak[pct] || 0) + (l.quantity || 0) * (l.unitPrice || 0) * pct / 100;
  });

  const lineRows = lines.filter(l => l.name).map((l, i) => {
    const lt = (l.quantity || 0) * (l.unitPrice || 0);
    const ta = lt * (l.taxRate || 0) / 100;
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;">${i + 1}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;font-weight:600;">${l.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:center;">${l.quantity || 1}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:center;">${l.unit || 'Adet'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:right;">${fmt(l.unitPrice)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:center;">%${l.taxRate || 0}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:right;color:#ef4444;">${fmt(ta)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:700;">${fmt(lt + ta)}</td>
      </tr>`;
  }).join('');

  const vatRows = Object.entries(vatBreak).map(([pct, amt]) => {
    const mat = lines.filter(l => (l.taxRate || 0) == pct).reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
    return `
      <tr style="background:#f8fafc;">
        <td colspan="5" style="padding:6px 14px;color:#64748b;font-size:12px;">KDV %${pct} Matrahı</td>
        <td style="padding:6px 14px;text-align:right;font-size:12px;">${fmt(mat)}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td colspan="5" style="padding:6px 14px;color:#3b82f6;font-size:12px;">KDV %${pct}</td>
        <td style="padding:6px 14px;text-align:right;font-size:12px;color:#3b82f6;">${fmt(amt)}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Taslak Fatura Önizlemesi</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f1f5f9; color: #1e293b; }
    .page { max-width: 860px; margin: 24px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: #fff; padding: 32px 40px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .company-meta { font-size: 12px; opacity: 0.75; margin-top: 6px; line-height: 1.6; }
    .inv-badge { text-align: right; }
    .inv-badge .label { font-size: 11px; font-weight: 700; letter-spacing: 2px; opacity: 0.7; text-transform: uppercase; }
    .inv-badge .number { font-size: 22px; font-weight: 800; margin-top: 4px; letter-spacing: -0.5px; }
    .draft-ribbon { display: inline-block; background: rgba(245,158,11,0.25); border: 1px solid rgba(245,158,11,0.5); color: #fbbf24; font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; padding: 3px 10px; border-radius: 4px; margin-top: 8px; }
    .meta-row { display: flex; gap: 32px; margin-top: 24px; }
    .meta-item .meta-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; opacity: 0.6; text-transform: uppercase; }
    .meta-item .meta-value { font-size: 14px; font-weight: 600; margin-top: 3px; }
    .body { padding: 32px 40px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .party-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
    .party-label { font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; }
    .party-name { font-size: 16px; font-weight: 700; color: #0f172a; }
    .party-detail { font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.7; }
    .party-detail span { color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    thead tr { background: #1e3a5f; color: #fff; }
    thead th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
    thead th:not(:first-child):not(:nth-child(2)) { text-align: center; }
    thead th:last-child, thead th:nth-last-child(2) { text-align: right; }
    tbody tr:hover { background: #f8fafc; }
    .totals { border-top: 2px solid #e2e8f0; padding-top: 0; }
    .total-grid { display: grid; grid-template-columns: 1fr auto; max-width: 320px; margin-left: auto; margin-top: 12px; gap: 0; }
    .total-row { display: contents; }
    .total-lbl { padding: 7px 0; font-size: 13px; color: #64748b; text-align: right; padding-right: 16px; }
    .total-val { padding: 7px 0; font-size: 13px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .grand-lbl { padding: 10px 0; font-size: 16px; font-weight: 800; color: #0f172a; text-align: right; padding-right: 16px; }
    .grand-val { padding: 10px 0; font-size: 16px; font-weight: 800; color: #2563eb; text-align: right; font-variant-numeric: tabular-nums; }
    .divider { grid-column: 1/-1; border-top: 2px solid #0f172a; margin: 4px 0; }
    .notes-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-top: 24px; }
    .notes-box .notes-label { font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #92400e; text-transform: uppercase; margin-bottom: 6px; }
    .notes-box p { font-size: 13px; color: #78350f; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 40px; display: flex; justify-content: space-between; align-items: center; }
    .footer p { font-size: 11px; color: #94a3b8; }
    .draft-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(245,158,11,0.08); pointer-events: none; z-index: 0; white-space: nowrap; letter-spacing: 0.1em; }
    @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; border-radius: 0; } .draft-watermark { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="draft-watermark">TASLAK</div>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-meta">
          ${companyVkntckn ? `VKN/TCKN: <strong>${companyVkntckn}</strong><br>` : ''}
          ${companyAddress || ''}${companyCity ? ', ' + companyCity : ''}
          ${companyTaxOffice ? `<br>Vergi Dairesi: ${companyTaxOffice}` : ''}
        </div>
      </div>
      <div class="inv-badge">
        <div class="label">Fatura No</div>
        <div class="number">TASLAK</div>
        <div class="draft-ribbon">⚠ Taslak Önizlemesi</div>
      </div>
    </div>
    <div class="meta-row">
      <div class="meta-item">
        <div class="meta-label">Fatura Tarihi</div>
        <div class="meta-value">${fmtD(today)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Para Birimi</div>
        <div class="meta-value">${currency}</div>
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">
    <!-- Taraflar -->
    <div class="parties">
      <div class="party-card">
        <div class="party-label">Satıcı (Firma)</div>
        <div class="party-name">${companyName}</div>
        <div class="party-detail">
          ${companyVkntckn ? `<span>VKN/TCKN:</span> ${companyVkntckn}<br>` : ''}
          ${companyTaxOffice ? `<span>Vergi Dairesi:</span> ${companyTaxOffice}<br>` : ''}
          ${companyAddress ? `<span>Adres:</span> ${companyAddress}${companyCity ? ', ' + companyCity : ''}` : ''}
        </div>
      </div>
      <div class="party-card">
        <div class="party-label">Alıcı (Müşteri)</div>
        <div class="party-name">${customerName}</div>
        <div class="party-detail">
          ${customerVkntckn ? `<span>VKN/TCKN:</span> ${customerVkntckn}<br>` : ''}
          ${customerTaxOffice ? `<span>Vergi Dairesi:</span> ${customerTaxOffice}<br>` : ''}
          ${customerAddress ? `<span>Adres:</span> ${customerAddress}${customerCity ? ', ' + customerCity : ''}` : ''}
        </div>
      </div>
    </div>

    <!-- Ürün tablosu -->
    <table>
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th>Ürün / Hizmet</th>
          <th style="width:70px;text-align:center;">Miktar</th>
          <th style="width:60px;text-align:center;">Birim</th>
          <th style="width:110px;text-align:right;">Birim Fiyat</th>
          <th style="width:60px;text-align:center;">KDV%</th>
          <th style="width:100px;text-align:right;">KDV</th>
          <th style="width:120px;text-align:right;">Tutar (KDV'li)</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>

    <!-- Toplamlar -->
    <div class="totals">
      <div class="total-grid">
        <div class="total-lbl">Ara Toplam (KDV Hariç)</div>
        <div class="total-val">${fmt(subtotal)}</div>
        ${vatRows.replace(/<tr[^>]*>[\s\S]*?<\/tr>/g, (m) => {
          // vatRows'daki table satırları format farkından dolayı burada çevrilemiyor,
          // bunun yerine aşağıda ayrı yazdık
          return '';
        })}
        ${Object.entries(vatBreak).map(([pct, amt]) => `
        <div class="total-lbl" style="color:#3b82f6;">KDV %${pct}</div>
        <div class="total-val" style="color:#3b82f6;">${fmt(amt)}</div>`).join('')}
        <div class="divider"></div>
        <div class="grand-lbl">GENEL TOPLAM</div>
        <div class="grand-val">${fmt(grandTotal)}</div>
      </div>
    </div>

    ${notes ? `<div class="notes-box"><div class="notes-label">Sipariş Notu</div><p>${notes}</p></div>` : ''}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>Bu belge taslak önizlemesidir ve resmi fatura değildir.</p>
    <p>Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
  </div>
</div>
</body>
</html>`;

  return res.json({ success: true, html });
}
