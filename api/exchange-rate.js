/**
 * /api/exchange-rate.js
 * TCMB (Türkiye Cumhuriyet Merkez Bankası) döviz kuru servisi.
 * 
 * GET /api/exchange-rate?currency=USD       → Güncel kur
 * GET /api/exchange-rate?currency=USD&date=2024-01-15  → Tarihe göre kur
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
    return res.status(400).json({ success: false, error: `Desteklenmeyen para birimi: ${currency}. Desteklenenler: ${supportedCurrencies.join(', ')}` });
  }

  try {
    // TCMB XML feed — güncel kurlar
    // today.xml: günlük kurlar, belirli tarih: /YYYY/MM/DDMMYYYY.xml
    let tcmbUrl;
    if (dateStr) {
      const d = new Date(dateStr);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      tcmbUrl = `https://www.tcmb.gov.tr/kurlar/${yy}${mm}/${dd}${mm}${yy}.xml`;
    } else {
      tcmbUrl = 'https://www.tcmb.gov.tr/kurlar/today.xml';
    }

    const response = await fetch(tcmbUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 A-ERP/1.0' }
    });

    if (!response.ok) {
      // Hafta sonu/tatil günlerinde today.xml boş olabilir, bir önceki iş gününü dene
      if (!dateStr) {
        // Alternatif: TCMB JSON API
        const altRes = await fetch('https://api.genelpara.com/embed/doviz.json');
        if (altRes.ok) {
          const altData = await altRes.json();
          const currMap = { USD: 'USD', EUR: 'EUR', GBP: 'GBP' };
          const key = currMap[currency];
          if (key && altData[key]) {
            return res.json({
              success: true,
              currency,
              rate: parseFloat(altData[key].satis) || 0,
              buyRate: parseFloat(altData[key].alis) || 0,
              source: 'genelpara_fallback',
              date: new Date().toISOString().slice(0, 10)
            });
          }
        }
      }
      throw new Error(`TCMB yanıtı başarısız: ${response.status}`);
    }

    const xml = await response.text();

    // XML'den kur çekme (basit regex — XML parser gerektirmez)
    const currencyCodeMap = {
      USD: 'US DOLLAR', EUR: 'EURO', GBP: 'BRITISH POUND', CHF: 'SWISS FRANC',
      JPY: 'JAPANESE YEN', CAD: 'CANADIAN DOLLAR', AUD: 'AUSTRALIAN DOLLAR',
      SEK: 'SWEDISH KRONA', NOK: 'NORWEGIAN KRONE', DKK: 'DANISH KRONE',
      SAR: 'SAUDI RIYAL', KWD: 'KUWAITI DINAR', RUB: 'RUSSIAN ROUBLE', CNY: 'CHINESE RENMINBI'
    };

    // Döviz koduna göre Currency bloğunu bul
    const crossCodeRegex = new RegExp(`<Currency\\s+CrossOrder="\\d+"\\s+Kod="${currency}"[^>]*>([\\s\\S]*?)</Currency>`);
    const match = xml.match(crossCodeRegex);

    if (!match) {
      // Alternatif pattern — bazı durumlarda CurrencyCode attribute farklı
      const altMatch = xml.match(new RegExp(`Kod="${currency}"[\\s\\S]*?<ForexSelling>([\\d.,]+)</ForexSelling>`));
      if (altMatch) {
        return res.json({
          success: true,
          currency,
          rate: parseFloat(altMatch[1].replace(',', '.')) || 0,
          source: 'tcmb_alt',
          date: dateStr || new Date().toISOString().slice(0, 10)
        });
      }
      throw new Error(`${currency} kuru TCMB verisinde bulunamadı`);
    }

    const block = match[1];
    const forexBuying = (block.match(/<ForexBuying>([\d.,]+)<\/ForexBuying>/) || [])[1];
    const forexSelling = (block.match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/) || [])[1];
    const banknoteBuying = (block.match(/<BanknoteBuying>([\d.,]+)<\/BanknoteBuying>/) || [])[1];
    const banknoteSelling = (block.match(/<BanknoteSelling>([\d.,]+)<\/BanknoteSelling>/) || [])[1];

    const sellRate = parseFloat((forexSelling || '0').replace(',', '.'));
    const buyRate = parseFloat((forexBuying || '0').replace(',', '.'));

    // Tarih bilgisi
    const dateMatch = xml.match(/<Tarih_Date\s+Tarih="([\d.]+)"/);
    const tcmbDate = dateMatch ? dateMatch[1] : (dateStr || new Date().toISOString().slice(0, 10));

    return res.json({
      success: true,
      currency,
      rate: sellRate,        // Satış kuru (fatura için bu kullanılır)
      buyRate,               // Alış kuru
      banknoteSelling: parseFloat((banknoteSelling || '0').replace(',', '.')) || null,
      banknoteBuying: parseFloat((banknoteBuying || '0').replace(',', '.')) || null,
      source: 'tcmb',
      date: tcmbDate
    });
  } catch (err) {
    console.error('[exchange-rate]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
