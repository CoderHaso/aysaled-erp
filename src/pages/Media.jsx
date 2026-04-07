import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Search, Trash2, Image, FileText, X, Loader2,
  CheckCircle2, Link2, Grid3X3, List, RefreshCw, Eye
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-[400] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold"
      style={{ background: type === 'error' ? '#ef4444' : '#10b981' }}>
      {msg}
    </motion.div>
  );
}

function fmtSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

export default function Media() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]     = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [preview, setPreview]   = useState(null);
  const [toast, setToast]       = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Dosyayı base64'e çevir
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // data:mime;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // API'ye gönder — server B2'ye yükler (CORS yok)
      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileData: base64,
          name: file.name.replace(/\.[^.]+$/, ''),
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);

      showToast(`"${file.name}" yüklendi ✓`);
      await load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    Array.from(e.target.files || []).forEach(uploadFile);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files || []).forEach(uploadFile);
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`"${item.name}" silinsin mi?`)) return;
    await fetch(`/api/media?key=${encodeURIComponent(item.file_key)}`, { method: 'DELETE' });
    showToast(`"${item.name}" silindi`);
    await load();
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    showToast('URL kopyalandı ✓');
  };

  const filtered = items.filter(i =>
    (i.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const isImage = (mime) => mime?.startsWith('image/');

  const c = {
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    bg:     isDark ? '#0f172a' : '#f8fafc',
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>Medya Kütpühanesi</h1>
            <p className="text-slate-400 text-sm mt-0.5">{items.length} dosya · Backblaze B2</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-xl transition-colors"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: '#64748b' }}>
              <RefreshCw size={16} />
            </button>
            <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-xl transition-colors"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: '#64748b' }}>
              {viewMode === 'grid' ? <List size={16} /> : <Grid3X3 size={16} />}
            </button>
            <button onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
              style={{ background: `linear-gradient(135deg, ${currentColor}, ${currentColor}cc)` }}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Yükle
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileInput} />
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Dosya ara..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm placeholder-slate-500 outline-none"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: `1px solid ${c.border}`, color: isDark ? '#f1f5f9' : '#1e293b' }} />
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="mb-6 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? currentColor : 'rgba(148,163,184,0.2)',
            background: dragOver ? `${currentColor}10` : 'transparent',
          }}>
          <Upload size={28} className="mx-auto mb-2 text-slate-500" />
          <p className="text-slate-400 text-sm">Dosyaları sürükle bırak veya tıkla</p>
          <p className="text-slate-600 text-xs mt-1">JPG, PNG, WebP, PDF · Max 50MB</p>
        </div>

        {/* Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Image size={48} className="mx-auto mb-3 opacity-20 text-slate-400" />
            <p className="text-slate-500">{search ? 'Sonuç bulunamadı' : 'Henüz dosya yüklenmedi'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="group relative rounded-2xl overflow-hidden cursor-pointer"
                style={{ background: c.card, border: `1px solid ${c.border}` }}>
                {/* Thumbnail */}
                <div className="aspect-square relative overflow-hidden bg-slate-800/50"
                  onClick={() => setPreview(item)}>
                  {isImage(item.mime_type) ? (
                    <img src={item.file_url} alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText size={36} className="text-slate-500" />
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setPreview(item); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white">
                      <Eye size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); copyUrl(item.file_url); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white">
                      <Link2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteItem(item); }}
                      className="p-1.5 rounded-lg bg-red-500/60 hover:bg-red-500/80 text-white">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate" style={{ color: isDark ? '#cbd5e1' : '#475569' }} title={item.name}>{item.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{fmtSize(item.size_bytes)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
            {filtered.map((item, i) => (
              <div key={item.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors border-b last:border-b-0"
                style={{ borderColor: c.border }}>
                {/* Thumb */}
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800/50">
                  {isImage(item.mime_type)
                    ? <img src={item.file_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><FileText size={18} className="text-slate-500" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{item.name}</p>
                  <p className="text-[11px] text-slate-500">{fmtSize(item.size_bytes)} · {fmtDate(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setPreview(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Eye size={14} /></button>
                  <button onClick={() => copyUrl(item.file_url)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Link2 size={14} /></button>
                  <button onClick={() => deleteItem(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setPreview(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="relative max-w-3xl max-h-[85vh] w-full rounded-2xl overflow-hidden"
              style={{ background: isDark ? '#1e293b' : '#ffffff' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <p className="text-sm font-semibold" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{preview.name}</p>
                <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="p-4 flex items-center justify-center min-h-[300px]">
                {isImage(preview.mime_type)
                  ? <img src={preview.file_url} alt={preview.name} className="max-h-[60vh] max-w-full object-contain rounded-xl" />
                  : <div className="text-center text-slate-400"><FileText size={56} className="mx-auto mb-2" /><p>{preview.name}</p></div>}
              </div>
              <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
                <div className="text-xs text-slate-500">{fmtSize(preview.size_bytes)} · {preview.mime_type}</div>
                <div className="flex gap-2">
                  <button onClick={() => copyUrl(preview.file_url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <Link2 size={12} /> URL Kopyala
                  </button>
                  <a href={preview.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: currentColor }}>
                    Aç
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}
