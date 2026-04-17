import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase bilgileri
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qtlcsylzenqlpkqojkon.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mdE70dvCDgBUria3WNA5Wg_mkzPmN6y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importCariler() {
  console.log("=== UYUMSOFT CARİ İÇE AKTARIM VE KARŞILAŞTIRMA SERVSİ ===");
  
  // JSON dosyasını oku
  const jsonPath = path.join(process.cwd(), 'MO-LIST.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("MO-LIST.json bulunamadı!");
    return;
  }
  
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  let uyumsoftCariler = [];
  try {
    uyumsoftCariler = JSON.parse(rawData);
  } catch(e) {
    console.error("JSON okuma hatası:", e.message);
    return;
  }

  console.log(`Uyumsoft JSON dosyasında toplam ${uyumsoftCariler.length} adet cari (müşteri) bulundu.`);

  // Supabase'den mevcut müşterileri çek
  const { data: existingCustomers, error } = await supabase.from('customers').select('*');
  
  if (error) {
    console.error("Supabase'den veriler çekilirken hata:", error.message);
    return;
  }

  console.log(`Veritabanında önceden kayıtlı toplam ${existingCustomers.length} adet müşteri var.`);

  let eklenecekler = [];
  let guncellenecekler = [];

  for (const cari of uyumsoftCariler) {
    if (!cari.Title) continue;
    
    // Verilerdeki boşlukları temizleyelim
    const vkn = cari.VkTckNo ? cari.VkTckNo.trim() : null;
    const isim = cari.Title.trim();
    const vergiDairesi = cari.TaxOffice ? cari.TaxOffice.trim() : null;
    const il = cari.AddressCity ? cari.AddressCity.trim() : null;
    const ilce = cari.AddressSubDivisionName ? cari.AddressSubDivisionName.trim() : null;
    const acikAdres = cari.AddressStreetName ? cari.AddressStreetName.trim().replace(/\r\n/g, ' ') : null;
    const tel = cari.PhoneNumber ? cari.PhoneNumber.trim() : null;
    const eposta = cari.Email ? cari.Email.trim() : null;
    const cariKodu = cari.AccountCode;
    
    // Türü belirle (VKN 10 hane ise Kurumsal, TCKN 11 hane ise Bireysel)
    const cariTipi = (vkn && vkn.length === 11) ? 'individual' : 'corporate';

    // Veritabanında VKN ile veya VKN yoksa İsim ile eşleşen var mı kontrol et
    let eslesen = null;
    if (vkn) {
      eslesen = existingCustomers.find(c => c.vkntckn === vkn || c.tax_number === vkn);
    }
    if (!eslesen) {
      eslesen = existingCustomers.find(c => c.name && c.name.toLowerCase() === isim.toLowerCase());
    }

    const mYapi = {
      name: isim,
      vkntckn: vkn,
      tax_office: vergiDairesi,
      city: il,
      district: ilce,
      address: acikAdres,
      phone: tel,
      email: eposta,
      country: cari.AddressCountry ? cari.AddressCountry.trim() : null,
      source: 'uyumsoft-import'
    };

    if (eslesen) {
      // SADECE eksik olan bilgileri doldurmak üzere (Tamamen üstüne yazmıyoruz, sadece null olanları tamamlıyoruz)
      let needsUpdate = false;
      const willUpdate = {};

      if (!eslesen.tax_office && vergiDairesi) { willUpdate.tax_office = vergiDairesi; needsUpdate = true; }
      if (!eslesen.city && il) { willUpdate.city = il; needsUpdate = true; }
      if (!eslesen.district && ilce) { willUpdate.district = ilce; needsUpdate = true; }
      if (!eslesen.address && acikAdres) { willUpdate.address = acikAdres; needsUpdate = true; }
      if (!eslesen.phone && tel) { willUpdate.phone = tel; needsUpdate = true; }
      if (!eslesen.email && eposta) { willUpdate.email = eposta; needsUpdate = true; }
      if (!eslesen.vkntckn && vkn) { willUpdate.vkntckn = vkn; needsUpdate = true; }
      if (!eslesen.country && cari.AddressCountry) { willUpdate.country = cari.AddressCountry.trim(); needsUpdate = true; }

      if (needsUpdate) {
        guncellenecekler.push({ id: eslesen.id, updates: willUpdate, ism: isim });
      }
    } else {
      eklenecekler.push(mYapi);
    }
  }

  console.log(`\nKARŞILAŞTIRMA SONUCU:`);
  console.log(`- Tamamen yeni eklenecek cari sayısı: ${eklenecekler.length}`);
  console.log(`- Mevcut olup bilgileri tamamlanacak (eksikleri doldurulacak) cari sayısı: ${guncellenecekler.length}`);

  // Yeni eklenecekleri yolla
  if (eklenecekler.length > 0) {
    console.log("Yeni cariler veritabanına işleniyor...");
    const { error: insErr } = await supabase.from('customers').insert(eklenecekler);
    if (insErr) {
      console.error("Ekleme hatası (Bazı kolonlar tablonuzda ('tax_office', 'customer_code', vb.) bulunmuyor olabilir):", insErr.message);
    } else {
      console.log(`✓ ${eklenecekler.length} adet yeni müşteri başarıyla eklendi!`);
    }
  }

  // Güncellenecekleri yolla
  if (guncellenecekler.length > 0) {
    console.log("Eksik bilgileri olan cariler güncelleniyor...");
    let gHata = 0;
    for (const g of guncellenecekler) {
      const { error: updErr } = await supabase.from('customers').update(g.updates).eq('id', g.id);
      if (updErr) gHata++;
    }
    if (gHata > 0) {
      console.error(`Güncellenirken ${gHata} adet hatayla karşılaşıldı.`);
    } else {
      console.log(`✓ ${guncellenecekler.length} adet mevcut müşterinin Uyumsoft'taki eksik adres/tel/vergidaire bilgileri tamamlandı!`);
    }
  }

  console.log("\nİşlem Tamamlandı!");
}

importCariler();
