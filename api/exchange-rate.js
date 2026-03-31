/**
 * /api/exchange-rate.js
 * TCMB (Türkiye Cumhuriyet Merkez Bankası) döviz kuru servisi.
 * 
 * GET /api/exchange-rate?currency=USD       → Güncel kur
 * GET /api/exchange-rate?currency=USD&date=2024-01-15  → Tarihe göre kur
 * 
 * Hafta sonu / tatil günlerinde otomatik olarak bir önceki iş gününe döner.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const currency = (req.query.currency || 'USD').toUpperCase();
  const dateStr = req.query.date; // opsiyonel: YYYY-MM-DD

  // Desteklenen para birimleri
  const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'SAR', 'KWD', 'RUB', 'CNY'];
  if (currency === 'TRY') {
    return res.json({ success: true, currency: 'TRY', rate: 1, source: 'identity' });
  }
  if (!supportedCurrencies.includes(currency)) {
    return res.status(400).json({ success: false, error: `Desteklenmeyen para birimi: ${currency}` });
  }

  try {
    // Tarih URL oluşturucu
    const buildTcmbUrl = (d) => {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `https://www.tcmb.gov.tr/kurlar/${yy}${mm}/${dd}${mm}${yy}.xml`;
    };

    // Başlangıç tarihi: belirtilmişse o, yoksa bugün (TR saatiyle = UTC+3)
    let startDate;
    if (dateStr) {
      startDate = new Date(dateStr + 'T12:00:00'); // Saat belirsizliğini önle
    } else {
      // Türkiye saati (UTC+3)
      const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000);
      startDate = new Date(nowTR.toISOString().slice(0, 10) + 'T12:00:00');
    }

    let xml = null;
    let foundDate = null;

    // En fazla 7 gün geriye git (hafta sonu + tatil güvenliği)
    for (let offset = 0; offset <= 7; offset++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() - offset);
      const url = buildTcmbUrl(d);
      try {
        const r = await fetch(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0 A-ERP/1.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (r.ok) {
          const text = await r.text();
          if (text && text.includes('<ForexSelling>')) {
            xml = text;
            foundDate = d;
            break;
          }
        }
      } catch (_) { /* bu tarihi atla, bir öncekini dene */ }
    }

    // TCMB'den veri alınamadıysa üçüncü parti fallback
    if (!xml) {
      try {
        const altRes = await fetch('https://api.genelpara.com/embed/doviz.json', {
          signal: AbortSignal.timeout(5000)
        });
        if (altRes.ok) {
          const altData = await altRes.json();
          const key = ['USD', 'EUR', 'GBP'].includes(currency) ? currency : null;
          if (key && altData[key]) {
            return res.json({
              success: true, currency,
              rate: parseFloat(altData[key].satis) || 0,
              buyRate: parseFloat(altData[key].alis) || 0,
              source: 'genelpara_fallback',
              date: new Date().toISOString().slice(0, 10)
            });
          }
        }
      } catch (_) {}
      throw new Error('TCMB ve yedek döviz kaynağına 7 gün içinde ulaşılamadı');
    }

    // XML'den kur çekme (basit regex)
    const crossCodeRegex = new RegExp(`<Currency\\s+CrossOrder="\\d+"\\s+Kod="${currency}"[^>]*>([\\s\\S]*?)</Currency>`);
    const match = xml.match(crossCodeRegex);

    if (!match) {
      const altMatch = xml.match(new RegExp(`Kod="${currency}"[\\s\\S]*?<ForexSelling>([\\d.,]+)</ForexSelling>`));
      if (altMatch) {
        return res.json({
          success: true, currency,
          rate: parseFloat(altMatch[1].replace(',', '.')) || 0,
          source: 'tcmb_alt',
          date: foundDate?.toISOString().slice(0, 10) || dateStr || new Date().toISOString().slice(0, 10)
        });
      }
      throw new Error(`${currency} kuru TCMB verisinde bulunamadı`);
    }

    const block = match[1];
    const forexSelling  = (block.match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/) || [])[1];
    const forexBuying   = (block.match(/<ForexBuying>([\d.,]+)<\/ForexBuying>/)   || [])[1];
    const banknoteSell  = (block.match(/<BanknoteSelling>([\d.,]+)<\/BanknoteSelling>/) || [])[1];
    const banknoteBuy   = (block.match(/<BanknoteBuying>([\d.,]+)<\/BanknoteBuying>/)   || [])[1];

    const sellRate = parseFloat((forexSelling || '0').replace(',', '.'));
    const buyRate  = parseFloat((forexBuying  || '0').replace(',', '.'));

    const dateMatch = xml.match(/<Tarih_Date\s+Tarih="([\d.]+)"/);
    const tcmbDate  = dateMatch ? dateMatch[1] : foundDate?.toISOString().slice(0, 10);

    return res.json({
      success: true,
      currency,
      rate: sellRate,
      buyRate,
      banknoteSelling: parseFloat((banknoteSell || '0').replace(',', '.')) || null,
      banknoteBuying:  parseFloat((banknoteBuy  || '0').replace(',', '.')) || null,
      source: 'tcmb',
      date: tcmbDate,
      note: foundDate && Math.abs(foundDate - startDate) > 86400000 
        ? `Hafta sonu/tatil – ${foundDate.toLocaleDateString('tr-TR')} tarihi kullanıldı` 
        : undefined
    });

  } catch (err) {
    console.error('[exchange-rate]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
