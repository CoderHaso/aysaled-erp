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
    let xml = '';
    let usedTcmbUrl = '';
    let actualDateUsed = '';

    const tryFetch = async (targetDate) => {
      let tcmbUrl;
      const trOffset = 3 * 60 * 60 * 1000; // Turkey is UTC+3
      
      if (targetDate) {
        const yy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        tcmbUrl = `https://www.tcmb.gov.tr/kurlar/${yy}${mm}/${dd}${mm}${yy}.xml`;
        actualDateUsed = `${yy}-${mm}-${dd}`;
      } else {
        // "Today" in Turkey time
        const now = new Date();
        const nowTR = new Date(now.getTime() + trOffset);
        tcmbUrl = 'https://www.tcmb.gov.tr/kurlar/today.xml';
        actualDateUsed = nowTR.toISOString().slice(0, 10);
      }

      console.log(`[exchange-rate] Fetching: ${tcmbUrl}`);
      const response = await fetch(tcmbUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 A-ERP/1.0' }
      });

      if (response.ok) {
        usedTcmbUrl = tcmbUrl;
        return await response.text();
      }
      if (response.status === 404) return null;
      throw new Error(`TCMB API error: ${response.status}`);
    };

    if (dateStr) {
      let currentTryDate = new Date(dateStr);
      // Hafta sonu veya tatil olabilir, 5 gün geriye kadar dene
      for (let i = 0; i < 5; i++) {
        xml = await tryFetch(currentTryDate);
        if (xml) break;
        // Bir gün geriye git
        currentTryDate.setDate(currentTryDate.getDate() - 1);
      }
    } else {
      xml = await tryFetch(null);
    }

    if (!xml) {
      // Hala bulunamadıysa (veya dateStr yokken failure aldıysak) fallback servisleri dene
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
            requestedDate: dateStr || 'today',
            date: new Date().toISOString().slice(0, 10)
          });
        }
      }
      throw new Error(`TCMB verisi bulunamadı (Son 5 gün denendi).`);
    }

    // XML'den kur çekme (basit regex — XML parser gerektirmez)
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
          requestedDate: dateStr || 'today',
          date: actualDateUsed
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

    // XML içindeki gerçek tarih
    const dateMatch = xml.match(/<Tarih_Date\s+Tarih="([\d.]+)"/);
    const tcmbDate = dateMatch ? dateMatch[1] : actualDateUsed;

    return res.json({
      success: true,
      currency,
      rate: sellRate,
      buyRate,
      banknoteSelling: parseFloat((banknoteSelling || '0').replace(',', '.')) || null,
      banknoteBuying: parseFloat((banknoteBuying || '0').replace(',', '.')) || null,
      source: 'tcmb',
      requestedDate: dateStr || 'today',
      date: tcmbDate,
      actualDateUsed
    });
  } catch (err) {
    console.error('[exchange-rate]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
