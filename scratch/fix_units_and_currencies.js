import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// .env.local dosyasını manuel oku
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fixUnitsAndCurrencies() {
  console.log('🚀 Birim ve döviz senkronizasyonu başlatılıyor...');

  const { data: items, error: iErr } = await supabase.from('stock_items').select('id, name, unit, base_currency');
  const { data: recipeItems, error: rErr } = await supabase.from('recipe_items').select('item_id, item_name, unit');

  if (iErr || rErr) {
    console.error('❌ Veri çekme hatası:', iErr || rErr);
    return;
  }

  const itemMap = {};
  items.forEach(it => { itemMap[it.id] = it; });

  const usageStats = {}; 

  recipeItems.forEach(ri => {
    if (!ri.item_id) return;
    if (!usageStats[ri.item_id]) usageStats[ri.item_id] = { units: {} };
    
    const stats = usageStats[ri.item_id];
    stats.units[ri.unit] = (stats.units[ri.unit] || 0) + 1;
  });

  const updates = [];

  for (const itemId in usageStats) {
    const stats = usageStats[itemId];
    const currentItem = itemMap[itemId];
    if (!currentItem) continue;

    const sortedUnits = Object.entries(stats.units).sort((a, b) => b[1] - a[1]);
    const mostCommonUnit = sortedUnits[0][0];

    // Sadece "Adet" olanları veya tutarsız olanları düzelt
    if (currentItem.unit !== mostCommonUnit) {
      console.log(`📝 Birim Düzeltme: [${currentItem.name}] "${currentItem.unit}" -> "${mostCommonUnit}"`);
      updates.push(supabase.from('stock_items').update({ unit: mostCommonUnit }).eq('id', itemId));
    }
  }

  items.forEach(it => {
    const nameUpper = it.name.toUpperCase();
    if ((nameUpper.includes('USD') || nameUpper.includes('$')) && it.base_currency === 'TRY') {
        console.log(`💰 Döviz Düzeltme: [${it.name}] TRY -> USD`);
        updates.push(supabase.from('stock_items').update({ base_currency: 'USD' }).eq('id', it.id));
    }
  });

  if (updates.length === 0) {
    console.log('✅ Herhangi bir tutarsızlık bulunamadı.');
    return;
  }

  console.log(`⏳ ${updates.length} adet güncelleme yapılıyor...`);
  const results = await Promise.all(updates);
  
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} güncelleme hatayla sonuçlandı.`);
    console.error(errors[0].error);
  } else {
    console.log('🎉 Tüm güncellemeler başarıyla tamamlandı.');
  }
}

fixUnitsAndCurrencies();
