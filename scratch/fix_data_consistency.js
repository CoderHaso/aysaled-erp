
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser
function loadEnv() {
  // Check common env file names
  const envFiles = ['.env.local', '.env', '.env.development'];
  for (const file of envFiles) {
    const envPath = path.join(__dirname, '..', file);
    if (fs.existsSync(envPath)) {
      console.log(`Loading env from ${file}`);
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          process.env[key] = value.trim();
        }
      });
      break; 
    }
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing in .env files');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDataIntegrity() {
  console.log('--- Starting Data Integrity Fix ---');

  const { data: items, error: itemsErr } = await supabase
    .from('items')
    .select('id, name, unit, base_currency, purchase_price');

  if (itemsErr) {
    console.error('Error fetching items:', itemsErr);
    return;
  }

  console.log(`Found ${items.length} items.`);

  const commonSense = [
    { keywords: ['kablo', 'profil', 'şerit', 'hortum', 'boru', 'fitil'], unit: 'Metre' },
    { keywords: ['boya', 'tiner', 'sıvı', 'reçine'], unit: 'Litre' },
    { keywords: ['vida', 'somun', 'pul', 'led', 'direnç', 'kondansatör', 'transistör', 'armatür', 'driver', 'kasa', 'kapak', 'cam'], unit: 'Adet' },
    { keywords: ['sac', 'levha', 'pleksi'], unit: 'm²' },
  ];

  let updateCount = 0;
  for (const item of items) {
    let targetUnit = item.unit;
    let targetCurrency = item.base_currency || 'TRY';
    const lowerName = item.name.toLowerCase();

    for (const rule of commonSense) {
      if (rule.keywords.some(k => lowerName.includes(k))) {
        if (item.unit === 'Adet' || !item.unit) {
          targetUnit = rule.unit;
        }
        break;
      }
    }

    if (!['TRY', 'USD', 'EUR', 'GBP'].includes(targetCurrency)) {
      targetCurrency = 'TRY';
    }

    if (targetUnit !== item.unit || targetCurrency !== item.base_currency) {
      console.log(`Updating ${item.name}: ${item.unit} -> ${targetUnit}, ${item.base_currency} -> ${targetCurrency}`);
      const { error: updErr } = await supabase
        .from('items')
        .update({ unit: targetUnit, base_currency: targetCurrency })
        .eq('id', item.id);
      
      if (!updErr) updateCount++;
    }
  }

  console.log(`Updated ${updateCount} items.`);

  console.log('Checking orders for VAT consistency...');
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, is_invoiced, tax_total, grand_total, subtotal, discount_amount');

  if (ordersErr) {
    console.error('Error fetching orders:', ordersErr);
    return;
  }

  let orderUpdateCount = 0;
  for (const order of orders) {
    if (order.is_invoiced === false) {
      const subtotalAfterDiscount = (order.subtotal || 0) - (order.discount_amount || 0);
      const expectedGrandTotal = Math.round(subtotalAfterDiscount * 100) / 100;
      
      if (order.tax_total !== 0 || Math.abs(order.grand_total - expectedGrandTotal) > 0.1) {
        console.log(`Fixing order ${order.id}: grand_total ${order.grand_total} -> ${expectedGrandTotal}, tax_total ${order.tax_total} -> 0`);
        const { error: updErr } = await supabase
          .from('orders')
          .update({ tax_total: 0, grand_total: expectedGrandTotal })
          .eq('id', order.id);
        if (!updErr) orderUpdateCount++;
      }
    }
  }
  console.log(`Fixed ${orderUpdateCount} orders.`);

  console.log('--- Data Integrity Fix Completed ---');
}

fixDataIntegrity();
