// Ortak Uyumsoft SOAP client factory
// CJS modülü ESM içinden import etmek için createRequire kullanıyoruz
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const soap = require('soap');

// Vercel'de VITE_ prefix'siz key'ler serverless function'lara iletilir
const WSDL_URL = process.env.UYUMSOFT_WSDL || 'https://edonusumapi.uyum.com.tr/Services/Integration?wsdl';
const USERNAME = process.env.UYUMSOFT_USERNAME || process.env.VITE_UYUMSOFT_USERNAME || 'Uyumsoft';
const PASSWORD = process.env.UYUMSOFT_PASSWORD || process.env.VITE_UYUMSOFT_PASSWORD || 'Uyumsoft';

if (!process.env.UYUMSOFT_USERNAME) console.warn('[uyumsoft-client] UYUMSOFT_USERNAME env bulunamadi, varsayilan kullaniliyor!');

/**
 * Uyumsoft SOAP client oluşturur ve WSSecurity uygular.
 * @param {string} [customUser] - Dinamik api testleri için kullanıcı adı.
 * @param {string} [customPass] - Dinamik api testleri için şifre.
 * @param {string} [customWsdlUrl] - Test veya Prod ortam URL'si.
 * @returns {Promise<SoapClient>}
 */
export function createUyumsoftClient(customUser, customPass, customWsdlUrl) {
  const user = customUser || USERNAME;
  const pass = customPass || PASSWORD;
  const urlParams = customWsdlUrl || WSDL_URL;

  return new Promise((resolve, reject) => {
    soap.createClient(urlParams, (err, client) => {
      if (err) return reject(new Error(`SOAP bağlantı hatası: ${err.message}`));

      client.setSecurity(
        new soap.WSSecurity(user, pass, {
          hasTimeStamp: false,
          hasTokenPassword: true,
        })
      );

      resolve(client);
    });
  });
}

/** Callback tabanlı SOAP çağrısını Promise'e sarar */
export function callSoap(client, method, args) {
  return new Promise((resolve, reject) => {
    if (typeof client[method] !== 'function') {
      return reject(new Error(`Bilinmeyen SOAP metodu: ${method}`));
    }
    client[method](args, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}
