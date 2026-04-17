import soap from 'soap';
import fs from 'fs';

/**
 * Uyumsoft E-Dönüşüm Servisinde hangi metodların olduğuna dair test scripti.
 */
async function testUyumsoft() {
  console.log("==========================================");
  console.log(" UYUMSOFT API METHOD İNCELEME ARACI ");
  console.log("==========================================\n");

  const WSDL_URL = 'https://edonusumapi.uyum.com.tr/Services/Integration?wsdl';
  const PASSWORD = process.env.VITE_UYUMSOFT_PASSWORD || process.env.UYUMSOFT_PASSWORD;

  console.log(`Bağlanılan WSDL URL : ${WSDL_URL}`);

  console.log("\nServis metodları çekiliyor, lütfen bekleyiniz...");

  return new Promise((resolve, reject) => {
    soap.createClient(WSDL_URL, (err, client) => {
      if (err) {
        console.error("Hata oluştu:", err.message);
        return resolve();
      }

      const desc = client.describe();
      const serviceName = Object.keys(desc)[0];
      const portName = Object.keys(desc[serviceName])[0];
      const methods = Object.keys(desc[serviceName][portName]);

      console.log(`\nBağlantı Başarılı! Toplam ${methods.length} adet metod bulundu.`);
      
      const cariMethods = methods.filter(m => m.toLowerCase().includes('cari') || m.toLowerCase().includes('customer') || m.toLowerCase().includes('account'));
      
      if (cariMethods.length > 0) {
        console.log("\n--- CARİ İLE İLGİLİ BULUNAN METODLAR ---");
        cariMethods.forEach(m => console.log(`- ${m}`));
      } else {
        console.log("\n--- CARİ (CUSTOMER) İLE İLGİLİ METOD BULUNAMADI ---");
        console.log("Not: E-Dönüşüm (E-Fatura) API'si sadece fatura gönderip almak içindir.");
        console.log("Cari listesini çekmek için Uyumsoft Ön Muhasebe / ERP API Web Servis URL'sine ihtiyacımız var.");
      }

      console.log("\n--- KULLANILABİLİR BAZI ÖNEMLİ METODLAR ---");
      const sampleMethods = [
        "GetInboxInvoices", 
        "GetOutboxInvoices", 
        "GetSystemUsersCompressedList",
        "SendInvoice",
        "SaveAsDraft",
        "TryToGetAddressFromVknTckn"
      ];
      const availableSamples = methods.filter(m => sampleMethods.includes(m));
      availableSamples.forEach(m => console.log(`- ${m}`));
      
      console.log("\nScript tamamlandı.");
      resolve();
    });
  });
}

testUyumsoft();
