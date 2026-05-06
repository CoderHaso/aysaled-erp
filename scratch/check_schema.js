const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error('Error fetching orders:', error);
  } else if (data && data.length > 0) {
    console.log('Order columns:', Object.keys(data[0]));
  } else {
    console.log('No orders found to check columns.');
  }
}

checkSchema();
