import { createUyumsoftClient, callSoap } from './_uyumsoft-client.js';

export default async function handler(req, res) {
  // CORS Headers for API accessibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Sadece POST desteklenir' });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunlu' });

  try {
    // Sadece şifre veriyoruz, gerisini (_uyumsoft-client'te yazan test/prod WSDL url'i) client hallediyor
    const client = await createUyumsoftClient(username, password);
    
    // Kullanıcı bilgisini çekmeyi deniyoruz (Gerçek bir SOAP Auth Testi)
    const result = await callSoap(client, 'UserInfoWithNoCheck', {});

    // Dönen sonucu çekiyoruz (Eğer hata atmadan buraya geldiyse şifre kesinlikle doğrudur)
    const userData = result?.UserInfoWithNoCheckResult?.Value?.User || {};
    
    return res.status(200).json({ 
      success: true, 
      message: 'Bağlantı Başarılı', 
      user: userData 
    });
    
  } catch (err) {
    console.error('[Uyumsoft/test-auth] Hata:', err.message);
    
    const errMsg = err.message || '';
    
    // Özel hataları ayıklayalım (WCF auth başarısız olduğunda giden standart hata kelimeleri)
    if (errMsg.includes('401') || errMsg.includes('erişmek') || errMsg.includes('yetki') || errMsg.includes('denied') || errMsg.includes('Client')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Yetkilendirme Başarısız!', 
        detail: errMsg 
      });
    }
    
    // Eğer bağlantı tamamen kopuk vs ise 500 döner
    return res.status(500).json({ 
      success: false, 
      error: 'Bağlantı kurulamadı veya sistemsel hata.', 
      detail: errMsg 
    });
  }
}
