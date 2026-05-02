import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Search, X, Loader2, Image,
  Grid3X3, List, FileText
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { trNorm } from '../lib/trNorm';

export default function MediaPickerModal({ isOpen, onClose, onSelect }) {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    // Yalnızca resimleri yükle
    const { data } = await supabase.from('media')
        .select('*')
        .like('mime_type', 'image/%')
        .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
      setSearch('');
    }
  }, [isOpen, load]);

  const uploadFile = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name || `Pasted_Image_${Date.now()}.png`,
          mimeType: file.type || 'image/png',
          fileSize: file.size,
          fileData: base64,
          name: (file.name || `Pasted_Image_${Date.now()}`).replace(/\.[^.]+$/, ''),
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      await load();
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setUploading(false);
    }
  }, [load]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items || [];
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        files.forEach(uploadFile);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, uploadFile]);

  const handleFileInput = (e) => {
    Array.from(e.target.files || []).forEach(uploadFile);
    e.target.value = '';
  };

  const handleSelect = (item) => {
    onSelect({ url: item.file_url || item.publicUrl, ...item });
  };

  if (!isOpen) return null;

  const filtered = items.filter(i =>
    trNorm(i.name || '').includes(trNorm(search))
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl shadow-xl overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div>
                <h3 className={`font-bold text-lg flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Görsel Seç
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 tracking-wide border border-blue-500/20">
                    Kopyalayarak (Ctrl+V) Yapıştırabilirsiniz
                  </span>
                </h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20 text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Controls */}
            <div className={`p-4 flex gap-4 shrink-0 border-b ${isDark ? 'border-gray-800 bg-[#1e293b]' : 'border-gray-100 bg-gray-50'}`}>
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Görsellerde ara..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition"
                  style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', color: isDark ? '#fff' : '#000', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                  className={`p-2.5 rounded-xl transition-colors border ${isDark ? 'border-gray-700 hover:bg-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 hover:bg-gray-100 bg-white text-gray-600'}`}
                >
                  {viewMode === 'grid' ? <List size={18} /> : <Grid3X3 size={18} />}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold transition"
                  style={{ background: `linear-gradient(135deg, ${currentColor}, ${currentColor}cc)` }}
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Yükle
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <Loader2 size={32} className="animate-spin text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">Görseller Yükleniyor...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <Image size={40} className="text-gray-400 mb-3 opacity-30" />
                  <p className="text-gray-500 font-medium">Görsel bulunamadı</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filtered.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${isDark ? 'border-gray-800 hover:border-blue-500 bg-gray-900' : 'border-gray-200 hover:border-blue-500 bg-gray-100'}`}
                    >
                      <img src={item.file_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-[10px] truncate">{item.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`flex items-center gap-4 p-2 rounded-xl cursor-pointer border transition-colors ${isDark ? 'border-gray-800 hover:bg-gray-800 bg-gray-900/50' : 'border-gray-200 hover:bg-gray-50 bg-white'}`}
                    >
                      <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                        <img src={item.file_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <p className={`font-medium flex-1 truncate ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{item.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex justify-end shrink-0 ${isDark ? 'border-gray-800 bg-[#0f172a]' : 'border-gray-100 bg-white'}`}>
              <button onClick={onClose} className={`px-4 py-2 font-medium rounded-lg ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>İptal</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
