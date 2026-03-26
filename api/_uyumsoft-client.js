// Ortak Uyumsoft SOAP client factory
// CJS modülü ESM içinden import etmek için createRequire kullanıyoruz
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const soap = require('soap');

const WSDL_URL = process.env.UYUMSOFT_WSDL ||
  'https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl';
const USERNAME = process.env.UYUMSOFT_USERNAME || 'Uyumsoft';
const PASSWORD = process.env.UYUMSOFT_PASSWORD || 'Uyumsoft';

/**
 * Uyumsoft SOAP client oluşturur ve WSSecurity uygular.
 * @returns {Promise<SoapClient>}
 */
export function createUyumsoftClient() {
  return new Promise((resolve, reject) => {
    soap.createClient(WSDL_URL, (err, client) => {
      if (err) return reject(new Error(`SOAP bağlantı hatası: ${err.message}`));

      client.setSecurity(
        new soap.WSSecurity(USERNAME, PASSWORD, {
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
