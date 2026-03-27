// Ortak Uyumsoft SOAP client factory
// CJS modülü ESM içinden import etmek için createRequire kullanıyoruz
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const soap = require('soap');
const fs = require('fs');
const path = require('path');

// Vite development modunda process.env bazen yüklenmeyebiliyor. Bu nedenle el ile okuyoruz:
let envLocal = {};
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let val = match[2] || '';
        val = val.replace(/^['"]|['"]$/g, '');
        envLocal[key] = val;
      }
    });
  }
} catch (e) {
  // Yoksay
}

const getEnv = (key) => process.env[key] || process.env[`VITE_${key}`] || envLocal[key] || envLocal[`VITE_${key}`];

const WSDL_URL = getEnv('UYUMSOFT_WSDL') || 'https://edonusumapi.uyum.com.tr/Services/Integration?wsdl';
const USERNAME = getEnv('UYUMSOFT_USERNAME') || 'Uyumsoft';
const PASSWORD = getEnv('UYUMSOFT_PASSWORD') || 'Uyumsoft';

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
