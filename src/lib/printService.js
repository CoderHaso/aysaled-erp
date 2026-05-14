/**
 * Print Service — A-ERP Yazdırma Motoru
 * 
 * Şablon tabanlı yazdırma sistemi.
 * Şablonlar app_settings tablosunda saklanır.
 * {{değişken}} söz dizimi ile veri binding yapılır.
 * {{#each items}} ... {{/each}} ile liste döngüsü.
 * {{#if var}} ... {{/if}} ile koşullu gösterim.
 */

import { supabase } from './supabaseClient';

// ─── Şablon Türleri ─────────────────────────────────────────────────────────
export const TEMPLATE_TYPES = [
  { id: 'order',        label: 'Sipariş Fişi',        icon: '🛒', desc: 'Satış sipariş yazdırma şablonu' },
  { id: 'quote',        label: 'Teklif',              icon: '📋', desc: 'Müşteri teklif formu şablonu' },
  { id: 'recipe',       label: 'Reçete',              icon: '📦', desc: 'Ürün reçete kartı şablonu' },
  { id: 'cheque',       label: 'Çek',                 icon: '🏦', desc: 'Çek yazdırma şablonu' },
  { id: 'work_order',   label: 'İş Emri',             icon: '🔨', desc: 'Atölye iş emri şablonu' },
  { id: 'ledger',       label: 'Hesap Ekstresi',      icon: '📒', desc: 'Cari hesap ekstresi şablonu' },
  { id: 'cash_receipt', label: 'Kasa Makbuzu',        icon: '💵', desc: 'Kasa tahsilat/ödeme makbuzu' },
  { id: 'report',       label: 'Aylık Rapor',         icon: '📊', desc: 'Dashboard aylık rapor çıktısı' },
];

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────
const fmtMoney = (n, cur = '₺') =>
  `${cur}${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('tr-TR') : '-';
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Şablon Motoru ──────────────────────────────────────────────────────────
function resolveValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/** Tek bir satırdaki tüm {{...}} ifadelerini çöz (helpers dahil) */
function resolveAllBindings(text, ctx) {
  // 1) Helpers: {{fmt:x}} {{date:x}} {{datetime:x}} {{money:x}}
  text = text.replace(/\{\{fmt:([^}]+)\}\}/g, (_, key) => fmtNum(resolveValue(ctx, key.trim())));
  text = text.replace(/\{\{date:([^}]+)\}\}/g, (_, key) => fmtDate(resolveValue(ctx, key.trim())));
  text = text.replace(/\{\{datetime:([^}]+)\}\}/g, (_, key) => fmtDateTime(resolveValue(ctx, key.trim())));
  text = text.replace(/\{\{money:([^}]+)\}\}/g, (_, key) => fmtMoney(resolveValue(ctx, key.trim())));

  // 2) Simple: {{variable}} ve {{@index}}
  text = text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    if (k === '@index') return ctx._index ?? '';
    const val = resolveValue(ctx, k);
    return val !== undefined && val !== null ? val : '';
  });

  return text;
}

function renderTemplate(template, data) {
  if (!template) return '';
  let html = template;

  // {{#each items}} ... {{/each}}
  html = html.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, inner) => {
    const arr = data[key];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map((item, index) => {
      // İtem context: item verileri + parent data + _index
      const ctx = { ...data, ...item, _index: index + 1 };
      let row = inner;

      // Nested #if inside #each
      row = row.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (__, ifKey, ifInner) => {
        const val = resolveValue(ctx, ifKey.trim());
        return val ? resolveAllBindings(ifInner, ctx) : '';
      });

      return resolveAllBindings(row, ctx);
    }).join('');
  });

  // {{#if var}} ... {{/if}} (top-level)
  html = html.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
    const val = resolveValue(data, key.trim());
    return val ? resolveAllBindings(inner, data) : '';
  });

  // Kalan tüm binding'leri çöz
  html = resolveAllBindings(html, data);

  return html;
}

// ─── Ortak CSS Stilleri (yazdırma penceresi için) ────────────────────────────
const PRINT_STYLES = `
  @page { margin: 12mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; }
  .print-container { max-width: 210mm; margin: 0 auto; padding: 8mm; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  th { background: #f8fafc; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .text-sm { font-size: 11px; }
  .text-xs { font-size: 10px; }
  .text-lg { font-size: 16px; }
  .text-xl { font-size: 20px; }
  .text-muted { color: #64748b; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .py-1 { padding-top: 4px; padding-bottom: 4px; }
  .border-t { border-top: 1px solid #e2e8f0; }
  .border-b { border-bottom: 1px solid #e2e8f0; }
  .border-2 { border-top: 2px solid #1e293b; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .gap-2 { gap: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1e293b; }
  .header h1 { font-size: 20px; font-weight: 800; }
  .header .company { font-size: 10px; color: #64748b; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  .total-row td { font-weight: 700; border-top: 2px solid #1e293b; font-size: 12px; }
  .stamp-area { display: flex; justify-content: space-between; margin-top: 40px; }
  .stamp-box { width: 45%; text-align: center; }
  .stamp-box .line { border-top: 1px solid #94a3b8; margin-top: 50px; padding-top: 4px; font-size: 10px; color: #64748b; }
  .no-print { display: none; }
  @media screen { 
    body { background: #f1f5f9; padding: 20px; }
    .print-container { background: white; padding: 32px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .no-print { display: flex; position: fixed; top: 16px; right: 16px; z-index: 999; gap: 8px; align-items: center; }
    .no-print button { padding: 10px 24px; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; transition: background 0.2s; }
    .btn-print { background: #3b82f6; }
    .btn-print:hover { background: #2563eb; }
    .btn-share { background: #10b981; }
    .btn-share:hover { background: #059669; }
  }
`;

// ─── Toolbar HTML (Yazdır + Paylaş butonları) ────────────────────────────────
function getToolbarHTML(title) {
  return `
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Yazdır</button>
      <button class="btn-share" onclick="window.__sharePDF()">📤 Paylaş</button>
    </div>
  `;
}

// ─── PDF Paylaşım Script (yazdırma penceresine enjekte edilir) ────────────────
function getShareScript(title) {
  return `
    <script>
      window.__sharePDF = async function() {
        var btn = document.querySelector('.btn-share');
        var origText = btn.textContent;
        btn.textContent = '⏳ Hazırlanıyor...';
        btn.disabled = true;
        try {
          var el = document.querySelector('.print-container');
          var { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
          var { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
          var canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          var pdf = new jsPDF('p', 'mm', 'a4');
          var pw = 210, ph = 297;
          var imgW = pw, imgH = (canvas.height * imgW) / canvas.width;
          var imgData = canvas.toDataURL('image/jpeg', 0.92);
          var y = 0;
          while (y < imgH) { if (y > 0) pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, -y, imgW, imgH); y += ph; }
          var blob = pdf.output('blob');
          var file = new File([blob], '${title}.pdf', { type: 'application/pdf' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: '${title}', files: [file] });
          } else {
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '${title}.pdf';
            link.click();
            URL.revokeObjectURL(link.href);
          }
        } catch(e) {
          console.error('Paylaşım hatası:', e);
          alert('Paylaşım yapılamadı: ' + e.message);
        } finally {
          btn.textContent = origText;
          btn.disabled = false;
        }
      };
    <\/script>
  `;
}

// ─── Yazdırma Penceresi ─────────────────────────────────────────────────────
export function printHTML(html, title = 'Yazdır') {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) { alert('Popup engelleyici yazdırma penceresini engelledi!'); return; }
  const safeTitle = (title || 'Belge').replace(/'/g, '');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>
      ${getToolbarHTML(title)}
      <div class="print-container">
        ${html}
      </div>
      ${getShareScript(safeTitle)}
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ─── AI Özel HTML Yazdırma (şablon motoru olmadan, ham HTML) ─────────────────
export function printCustomHTML(html, title = 'AI Raporu') {
  printHTML(html, title);
}

// ─── PDF Oluştur & Web Share API ile Paylaş (sayfa içi kullanım) ─────────────
export async function sharePDF(elementId, title = 'Belge') {
  const el = document.getElementById(elementId);
  if (!el) return;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = 210, pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    let yOffset = 0;
    while (yOffset < imgH) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -yOffset, imgW, imgH);
      yOffset += pageH;
    }
    const pdfBlob = pdf.output('blob');
    const fileName = `${title}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Web Share API — hem mobil hem Windows 10/11 destekler
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, files: [file] });
    } else {
      // Fallback: PDF indir
      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  } catch (err) {
    console.error('PDF paylaşım hatası:', err);
    throw err;
  }
}

// ─── Şablonları Yönet ───────────────────────────────────────────────────────
const SETTINGS_KEY = 'print_templates';

export async function loadTemplates() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', SETTINGS_KEY)
    .maybeSingle();
  return data?.value || {};
}

export async function saveTemplates(templates) {
  await supabase.from('app_settings').upsert({
    id: SETTINGS_KEY,
    value: templates,
    updated_at: new Date().toISOString(),
  });
}

export async function getTemplate(type) {
  const all = await loadTemplates();
  return all[type] || DEFAULT_TEMPLATES[type] || '';
}

// ─── Yazdır (Ana Fonksiyon) ─────────────────────────────────────────────────
export async function printDocument(type, data, title) {
  const template = await getTemplate(type);
  const html = renderTemplate(template, {
    ...data,
    _today: fmtDate(new Date()),
    _now: fmtDateTime(new Date()),
    _company: 'AYSALED',
  });
  printHTML(html, title || TEMPLATE_TYPES.find(t => t.id === type)?.label || 'Yazdır');
}

// ─── Varsayılan Şablonlar ───────────────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
  // ── SİPARİŞ FİŞİ ──
  order: `<div class="header">
  <div>
    <h1>SİPARİŞ FİŞİ</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold">{{order_number}}</p>
    <p class="text-muted text-xs">{{date:created_at}}</p>
  </div>
</div>

<div class="flex justify-between mb-4">
  <div>
    <p class="text-xs text-muted">MÜŞTERİ</p>
    <p class="font-bold">{{customer_name}}</p>
    {{#if customer_vkntckn}}<p class="text-xs">VKN: {{customer_vkntckn}}</p>{{/if}}
  </div>
  <div style="text-align:right">
    <p class="text-xs text-muted">DURUM</p>
    <p class="font-bold">{{status}}</p>
    <p class="text-xs">Para Birimi: {{currency}}</p>
  </div>
</div>

<table>
  <thead>
    <tr><th>#</th><th>Ürün</th><th>Miktar</th><th>Birim</th><th class="text-right">Birim Fiyat</th><th class="text-right">KDV %</th><th class="text-right">Toplam</th></tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{@index}}</td>
      <td class="font-bold">{{item_name}}</td>
      <td>{{quantity}}</td>
      <td>{{unit}}</td>
      <td class="text-right">{{fmt:unit_price}}</td>
      <td class="text-right">%{{tax_rate}}</td>
      <td class="text-right font-bold">{{fmt:line_total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div style="width:50%; margin-left:auto" class="mt-4">
  <div class="flex justify-between py-1 text-sm"><span>Ara Toplam:</span><span>{{fmt:subtotal}}</span></div>
  <div class="flex justify-between py-1 text-sm"><span>KDV:</span><span>{{fmt:tax_total}}</span></div>
  <div class="flex justify-between py-1 font-bold border-2" style="font-size:14px"><span>GENEL TOPLAM:</span><span>{{fmt:grand_total}}</span></div>
</div>

{{#if notes}}<div class="mt-4 text-xs text-muted"><strong>Not:</strong> {{notes}}</div>{{/if}}

<div class="stamp-area">
  <div class="stamp-box"><div class="line">Düzenleyen</div></div>
  <div class="stamp-box"><div class="line">Teslim Alan</div></div>
</div>

<div class="footer">Bu belge {{_company}} A-ERP sistemi tarafından oluşturulmuştur. · {{_now}}</div>`,

  // ── TEKLİF ──
  quote: `<div class="header">
  <div>
    <h1>TEKLİF FORMU</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold">{{quote_number}}</p>
    <p class="text-muted text-xs">{{date:created_at}}</p>
    {{#if valid_until}}<p class="text-xs">Geçerlilik: {{date:valid_until}}</p>{{/if}}
  </div>
</div>

<div class="flex justify-between mb-4">
  <div>
    <p class="text-xs text-muted">MÜŞTERİ</p>
    <p class="font-bold">{{customer_name}}</p>
    {{#if project_name}}<p class="text-xs">Proje: {{project_name}}</p>{{/if}}
  </div>
</div>

<table>
  <thead>
    <tr><th>#</th><th>Ürün / Hizmet</th><th>Miktar</th><th>Birim</th><th class="text-right">Birim Fiyat</th><th class="text-right">Toplam</th></tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{@index}}</td>
      <td class="font-bold">{{name}}</td>
      <td>{{quantity}}</td>
      <td>{{unit}}</td>
      <td class="text-right">{{fmt:unit_price}}</td>
      <td class="text-right font-bold">{{fmt:total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div style="width:50%; margin-left:auto" class="mt-4">
  <div class="flex justify-between py-1 font-bold border-2" style="font-size:14px"><span>TOPLAM:</span><span>{{fmt:grand_total}} {{currency}}</span></div>
</div>

{{#if notes}}<div class="mt-4 text-xs text-muted"><strong>Not:</strong> {{notes}}</div>{{/if}}

<div class="stamp-area">
  <div class="stamp-box"><div class="line">Teklif Veren</div></div>
  <div class="stamp-box"><div class="line">Müşteri Onayı</div></div>
</div>

<div class="footer">Bu teklif {{_company}} tarafından hazırlanmıştır. · {{_now}}</div>`,

  // ── REÇETE ──
  recipe: `<div class="header">
  <div>
    <h1>REÇETE KARTI</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold text-lg">{{product_name}}</p>
    <p class="text-xs text-muted">{{recipe_name}}</p>
  </div>
</div>

{{#if description}}<p class="mb-4 text-sm">{{description}}</p>{{/if}}

<table>
  <thead>
    <tr><th>#</th><th>Hammadde</th><th class="text-right">Miktar</th><th>Birim</th><th class="text-right">Birim Maliyet</th><th class="text-right">Toplam Maliyet</th></tr>
  </thead>
  <tbody>
    {{#each ingredients}}
    <tr>
      <td>{{@index}}</td>
      <td class="font-bold">{{item_name}}</td>
      <td class="text-right">{{quantity}}</td>
      <td>{{unit}}</td>
      <td class="text-right">{{currency_sym}}{{fmt:unit_cost}}</td>
      <td class="text-right font-bold">{{currency_sym}}{{fmt:total_cost}}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="5">TOPLAM MALİYET</td>
      <td class="text-right">{{currency_sym}}{{fmt:total_cost}}</td>
    </tr>
  </tfoot>
</table>

{{#if tags}}<div class="mt-4 text-xs"><strong>Etiketler:</strong> {{tags}}</div>{{/if}}

<div class="footer">{{_company}} Reçete Yönetim Sistemi · {{_now}}</div>`,

  // ── ÇEK ──
  cheque: `<div class="header">
  <div>
    <h1>ÇEK BİLGİSİ</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold">Çek No: {{cheque_no}}</p>
    <p class="text-xs text-muted">Yön: {{direction_label}}</p>
  </div>
</div>

<div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px">
  <div class="flex justify-between mb-2">
    <div><p class="text-xs text-muted">TUTAR</p><p class="text-xl font-bold">{{fmt:amount}} {{currency}}</p></div>
    <div style="text-align:right"><p class="text-xs text-muted">BANKA</p><p class="font-bold">{{bank_name}}</p></div>
  </div>
  <div class="flex justify-between">
    <div><p class="text-xs text-muted">DÜZENLEME TARİHİ</p><p>{{date:issue_date}}</p></div>
    <div style="text-align:right"><p class="text-xs text-muted">VADE TARİHİ</p><p class="font-bold">{{date:due_date}}</p></div>
  </div>
</div>

<div class="flex justify-between mb-4">
  <div><p class="text-xs text-muted">ÇEKİ VEREN</p><p class="font-bold">{{from_name}}</p></div>
  <div style="text-align:right"><p class="text-xs text-muted">ÇEKİ ALAN</p><p class="font-bold">{{to_name}}</p></div>
</div>

<div><p class="text-xs text-muted">DURUM</p><p class="font-bold">{{status_label}}</p></div>

{{#if note}}<div class="mt-4 text-xs text-muted"><strong>Not:</strong> {{note}}</div>{{/if}}

<div class="footer">{{_company}} Çek Yönetim Sistemi · {{_now}}</div>`,

  // ── İŞ EMRİ ──
  work_order: `<div class="header">
  <div>
    <h1>İŞ EMRİ</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold">{{wo_number}}</p>
    <p class="text-xs text-muted">{{date:created_at}}</p>
  </div>
</div>

<div class="flex justify-between mb-4">
  <div>
    <p class="text-xs text-muted">ÜRÜN</p>
    <p class="font-bold text-lg">{{product_name}}</p>
    {{#if recipe_name}}<p class="text-xs">Reçete: {{recipe_name}}</p>{{/if}}
  </div>
  <div style="text-align:right">
    <p class="text-xs text-muted">ÜRETİM MİKTARI</p>
    <p class="font-bold text-lg">{{quantity}} {{unit}}</p>
    <p class="text-xs">Durum: {{status}}</p>
  </div>
</div>

{{#if customer_name}}<div class="mb-4"><p class="text-xs text-muted">MÜŞTERİ</p><p class="font-bold">{{customer_name}}</p></div>{{/if}}

<table>
  <thead>
    <tr><th>#</th><th>Hammadde</th><th class="text-right">Birim Reçete</th><th class="text-right">Toplam Gerekli</th><th>Birim</th></tr>
  </thead>
  <tbody>
    {{#each ingredients}}
    <tr>
      <td>{{@index}}</td>
      <td class="font-bold">{{item_name}}</td>
      <td class="text-right">{{per_unit}}</td>
      <td class="text-right font-bold" style="font-size:13px">{{total_qty}}</td>
      <td>{{unit}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

{{#if production_note}}<div class="mt-4 text-xs"><strong>Üretim Notu:</strong> {{production_note}}</div>{{/if}}

<div class="stamp-area">
  <div class="stamp-box"><div class="line">Onaylayan</div></div>
  <div class="stamp-box"><div class="line">Teslim Alan</div></div>
</div>

<div class="footer">{{_company}} · {{_now}}</div>`,

  // ── HESAP EKSTRESİ ──
  ledger: `<div class="header">
  <div>
    <h1>HESAP EKSTRESİ</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold">{{entity_name}}</p>
    {{#if vkntckn}}<p class="text-xs">VKN: {{vkntckn}}</p>{{/if}}
    <p class="text-xs text-muted">{{_today}}</p>
  </div>
</div>

<table>
  <thead>
    <tr><th>Tarih</th><th>Açıklama</th><th class="text-right">{{col_debit}}</th><th class="text-right">{{col_credit}}</th><th class="text-right">Bakiye</th></tr>
  </thead>
  <tbody>
    {{#each movements}}
    <tr>
      <td>{{date}}</td>
      <td>{{description}}</td>
      <td class="text-right">{{debit_fmt}}</td>
      <td class="text-right">{{credit_fmt}}</td>
      <td class="text-right font-bold">{{balance_fmt}}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="2">NET BAKİYE</td>
      <td class="text-right">{{fmt:total_debit}}</td>
      <td class="text-right">{{fmt:total_credit}}</td>
      <td class="text-right">{{fmt:net_balance}}</td>
    </tr>
  </tfoot>
</table>

<div class="footer">{{_company}} Hesap Defteri · {{_now}}</div>`,

  // ── KASA MAKBUZU ──
  cash_receipt: `<div class="header">
  <div>
    <h1>{{receipt_type}}</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="text-xs text-muted">{{date:date}}</p>
  </div>
</div>

<div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px; text-align:center">
  <p class="text-xs text-muted">TUTAR</p>
  <p class="text-xl font-bold">{{fmt:amount}} {{currency}}</p>
</div>

<div class="flex justify-between mb-4">
  <div><p class="text-xs text-muted">KATEGORİ</p><p class="font-bold">{{category}}</p></div>
  <div style="text-align:right"><p class="text-xs text-muted">KİŞİ</p><p class="font-bold">{{entity_name}}</p></div>
</div>

{{#if description}}<div class="mb-4"><p class="text-xs text-muted">AÇIKLAMA</p><p class="text-sm">{{description}}</p></div>{{/if}}

<div class="stamp-area">
  <div class="stamp-box"><div class="line">Düzenleyen</div></div>
  <div class="stamp-box"><div class="line">Teslim Alan/Eden</div></div>
</div>

<div class="footer">{{_company}} Kasa Sistemi · {{_now}}</div>`,

  // ── AYLIK RAPOR ──
  report: `<div class="header">
  <div>
    <h1>AYLIK RAPOR</h1>
    <p class="company">{{_company}}</p>
  </div>
  <div style="text-align:right">
    <p class="font-bold text-lg">{{month_name}} {{year}}</p>
    <p class="text-xs text-muted">{{_now}}</p>
  </div>
</div>

<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px">
  <div style="background:#f8fafc; padding:12px; border-radius:8px">
    <p class="text-xs text-muted">TOPLAM SATIŞ</p>
    <p class="text-lg font-bold">{{fmt:total_sales}}</p>
    <p class="text-xs">{{order_count}} sipariş</p>
  </div>
  <div style="background:#f8fafc; padding:12px; border-radius:8px">
    <p class="text-xs text-muted">NET KÂR</p>
    <p class="text-lg font-bold">{{fmt:net_profit}}</p>
    <p class="text-xs">Marj: %{{fmt:margin}}</p>
  </div>
  <div style="background:#f8fafc; padding:12px; border-radius:8px">
    <p class="text-xs text-muted">FATURALI</p>
    <p class="font-bold">{{invoiced_count}} sipariş · {{fmt:invoiced_total}}</p>
  </div>
  <div style="background:#f8fafc; padding:12px; border-radius:8px">
    <p class="text-xs text-muted">FATURASIZ</p>
    <p class="font-bold">{{non_invoiced_count}} sipariş · {{fmt:non_invoiced_total}}</p>
  </div>
</div>

{{#if items}}
<h3 class="font-bold mt-4 mb-2">En Çok Satılanlar</h3>
<table>
  <thead><tr><th>#</th><th>Ürün</th><th class="text-right">Adet</th><th class="text-right">Ciro</th></tr></thead>
  <tbody>
    {{#each items}}
    <tr><td>{{@index}}</td><td class="font-bold">{{name}}</td><td class="text-right">{{qty}}</td><td class="text-right">{{fmt:revenue}}</td></tr>
    {{/each}}
  </tbody>
</table>
{{/if}}

<div class="footer">{{_company}} Aylık Rapor · {{_now}}</div>`,
};
