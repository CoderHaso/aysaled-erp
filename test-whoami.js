import soap from 'soap';

async function testWhoAmI() {
  const url = 'https://edonusumapi.uyum.com.tr/Services/Integration?wsdl';
  const user = 'AysaLedAydinlatma_WebServis';
  const pass = 'G@EYTG%R';
  
  try {
    const client = await soap.createClientAsync(url);
    const wsSecurity = new soap.WSSecurity(user, pass, { hasTimeStamp: false, hasTokenCreated: false });
    client.setSecurity(wsSecurity);

    const [result] = await client.WhoAmIAsync({});
    import('fs').then(fs => fs.writeFileSync('whoami_utf8.json', JSON.stringify(result, null, 2), 'utf8'));
  } catch (err) {
    console.error('Hata:', err);
  }
}

testWhoAmI();
