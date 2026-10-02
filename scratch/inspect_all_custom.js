import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const content = fs.readFileSync('.env.local', 'utf8');
const env = {};
content.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').replace(/^["']|["']$/g, '').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectAllOrders() {
  const { data: ois } = await supabase.from('order_items')
    .select('id, order_id, item_name, item_id, quantity, unit_price, cost_at_sale, custom_recipe_items, recipe_id, notes')
    .order('created_at', { ascending: false });

  const { data: wos } = await supabase.from('work_orders')
    .select('id, order_id, item_name, custom_recipe_items, recipe_id, notes');

  const { data: items } = await supabase.from('items')
    .select('id, name, purchase_price, base_currency');

  const itemMap = {};
  items?.forEach(i => { itemMap[i.id] = i; });

  const woMap = {};
  wos?.forEach(w => {
    if (w.order_id) {
      if (!woMap[w.order_id]) woMap[w.order_id] = [];
      woMap[w.order_id].push(w);
    }
  });

  console.log(`Total order_items: ${ois?.length}`);

  let zeroCostCount = 0;
  let customRecipeCount = 0;

  ois?.forEach(oi => {
    const hasCustom = oi.custom_recipe_items && (Array.isArray(oi.custom_recipe_items) ? oi.custom_recipe_items.length > 0 : true);
    const relatedWos = woMap[oi.order_id] || [];
    const woWithCustom = relatedWos.find(w => w.custom_recipe_items && w.custom_recipe_items.length > 0);

    if (hasCustom || woWithCustom) {
      customRecipeCount++;
      const customList = oi.custom_recipe_items || woWithCustom?.custom_recipe_items;
      console.log('--- Custom Recipe Item ---');
      console.log('Order Item:', oi.item_name, 'Order ID:', oi.order_id, 'Cost at sale in DB:', oi.cost_at_sale);
      console.log('Custom List length:', customList?.length);
      console.log('Sample custom items:', JSON.stringify(customList?.slice(0, 3)));
    }
  });

  console.log(`\nTotal items with custom recipes: ${customRecipeCount}`);
}

inspectAllOrders();
