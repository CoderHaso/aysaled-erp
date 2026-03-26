import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ArrowLeft, AlertCircle, Box, MapPin, Barcode } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';

export default function QRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchItem() {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
      if (error) {
        setError('Ürün bulunamadı veya silinmiş.');
      } else {
        setItem(data);
      }
      setLoading(false);
    }
    fetchItem();
  }, [id]);

  const c = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0'
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: c.bg, color: c.text }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Package size={32} style={{ color: currentColor }} />
        </motion.div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center" style={{ background: c.bg }}>
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2" style={{ color: c.text }}>Oops! Eşleşme Bulunamadı</h2>
        <p className="mb-6" style={{ color: c.muted }}>{error || 'Okuttuğunuz QR koda ait ürün sistemde mevcut değil.'}</p>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-xl font-bold text-white transition-opacity hover:opacity-90" style={{ background: currentColor }}>
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: c.bg, color: c.text }}>
      <div className="max-w-md mx-auto">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 mb-6 transition-opacity hover:opacity-75" style={{ color: c.muted }}>
          <ArrowLeft size={20} />
          <span className="font-semibold">Geri Dön</span>
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-3xl shadow-lg border" style={{ background: c.cardBg, borderColor: c.border }}>
          <div className="flex items-center gap-4 mb-8 pb-6 border-b" style={{ borderColor: c.border }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: 'var(--input-bg)' }}>
              <Package size={32} style={{ color: currentColor }} />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: currentColor }}>
                {item.item_type === 'product' ? 'Mamül' : 'Hammadde'}
              </div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: c.text }}>{item.name}</h1>
              <p className="text-sm mt-1 font-medium" style={{ color: c.muted }}>{item.category || 'Kategorisiz'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'var(--input-bg)' }}>
              <div className="flex items-center gap-3">
                <Box size={20} style={{ color: c.muted }} />
                <span className="font-medium" style={{ color: c.muted }}>Mevcut Stok</span>
              </div>
              <span className="text-2xl font-black" style={{ color: c.text }}>
                {item.stock_count} <span className="text-sm font-medium" style={{ color: c.muted }}>{item.unit}</span>
              </span>
            </div>

            <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'var(--input-bg)' }}>
              <div className="flex items-center gap-3">
                <Barcode size={20} style={{ color: c.muted }} />
                <span className="font-medium" style={{ color: c.muted }}>SKU Kodu</span>
              </div>
              <span className="font-bold text-right" style={{ color: c.text }}>{item.sku || 'N/A'}</span>
            </div>

            {item.location && (
              <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'var(--input-bg)' }}>
                <div className="flex items-center gap-3">
                  <MapPin size={20} style={{ color: c.muted }} />
                  <span className="font-medium" style={{ color: c.muted }}>Raf Konumu</span>
                </div>
                <span className="font-bold text-right" style={{ color: c.text }}>{item.location}</span>
              </div>
            )}
            
            {item.description && (
              <div className="mt-6 p-4 rounded-xl border" style={{ borderColor: c.border, background: 'var(--input-bg)' }}>
                <p className="text-sm leading-relaxed" style={{ color: c.text }}>{item.description}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
