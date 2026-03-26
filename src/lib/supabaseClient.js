import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY eksik.\n' +
    'Kök dizinde .env.local dosyası oluştur ve değerleri gir.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Bağlantı testi (sadece dev modda)
if (import.meta.env.DEV && supabaseUrl) {
  supabase.from('items').select('count', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) console.warn('[Supabase] Bağlantı sorunu:', error.message);
      else console.log('[Supabase] Bağlantı başarılı ✅');
    });
}
