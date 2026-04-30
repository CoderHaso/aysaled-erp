import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, HardDrive, Shield, Loader2, CheckCircle2, RefreshCcw, AlertTriangle, FileDown, FileUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import JSZip from 'jszip';

const BACKUP_MODULES = [
  { id: 'cariler',      label: 'Cariler',                  icon: '👥', tables: ['customers'] },
  { id: 'tedarikciler', label: 'Tedarikçiler',             icon: '🏭', tables: ['suppliers'] },
  { id: 'stok',         label: 'Stok & Kategoriler',       icon: '📦', tables: ['items','item_categories','stock_movements'] },
  { id: 'receteler',    label: 'Reçeteler',                icon: '📋', tables: ['product_recipes','recipe_items','bom_recipes'] },
  { id: 'siparisler',   label: 'Siparişler & İş Emirleri', icon: '🛒', tables: ['orders','order_items','work_orders'] },
  { id: 'teklifler',    label: 'Teklifler',                icon: '📄', tables: ['quotes'] },
  { id: 'faturalar',    label: 'Faturalar',                icon: '🧾', tables: ['invoices'] },
  { id: 'odemeler',     label: 'Ödemeler & Hesap Defteri', icon: '💳', tables: ['payments','cari_hareketler'] },
  { id: 'cekler',       label: 'Çekler',                   icon: '📝', tables: ['cheques'] },
  { id: 'kasa',         label: 'Kasa',                     icon: '💰', tables: ['cash_transactions'] },
  { id: 'medya',        label: 'Medya (Görseller)',        icon: '🖼️', tables: ['media'], heavy: true },
  { id: 'katalog',      label: 'Katalog',                  icon: '📚', tables: ['catalogs'] },
  { id: 'ayarlar',      label: 'Ayarlar & Kullanıcılar',  icon: '⚙️', tables: ['app_settings','profiles'] },
  { id: 'bildirimler',  label: 'Bildirimler',              icon: '🔔', tables: ['notifications'] },
];

const ALL_TABLES = [
  'app_settings','profiles','item_categories','suppliers','customers',
  'items','stock_movements','product_recipes','recipe_items','bom_recipes',
  'orders','order_items','work_orders','quotes','invoices',
  'payments','cari_hareketler','cheques','cash_transactions',
  'notifications','media','catalogs',
];

// FK sırasının tersi — silme için
const DELETE_ORDER = [...ALL_TABLES].reverse();

// Ağır tablolar — büyük JSONB alanları olan tablolar küçük sayfa boyutuyla başlar
const HEAVY_TABLES = ['invoices', 'quotes', 'orders', 'catalogs'];

async function fetchTable(name, onProgress) {
  const rows = [];
  let from = 0;
  let ps = HEAVY_TABLES.includes(name) ? 200 : 500;

  while (true) {
    let data, error;
    let retries = 0;
    while (retries < 3) {
      const res = await supabase.from(name).select('*').range(from, from + ps - 1);
      data = res.data; error = res.error;
      if (!error) break;
      // Timeout veya 500 hatası — sayfa boyutunu küçült ve tekrar dene
      retries++;
      ps = Math.max(10, Math.floor(ps / 3));
      if (onProgress) onProgress(`${name}: yeniden deneniyor (sayfa: ${ps})...`);
      await new Promise(r => setTimeout(r, 500));
    }
    if (error) throw new Error(`${name}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (onProgress) onProgress(`${name}: ${rows.length} kayıt...`);
    if (data.length < ps) break;
    from += ps;
  }
  return rows;
}

async function fetchMediaBlob(fileKey) {
  try {
    const r = await fetch(`/api/media-proxy?key=${encodeURIComponent(fileKey)}`);
    if (!r.ok) return null;
    return await r.blob();
  } catch { return null; }
}

export default function BackupManager({ c, currentColor, isDark }) {
  const [backupType, setBackupType] = useState('full');
  const [restoreType, setRestoreType] = useState('full');
  const [selectedModules, setSelectedModules] = useState([]);
  const [restoreModules, setRestoreModules] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [restoreZip, setRestoreZip] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreInfo, setRestoreInfo] = useState(null);
  const fileRef = useRef(null);

  const toggle = (id, setter) => setter(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);

  const getTablesForModules = (mods) => {
    if (!mods || mods.length === 0) return [...ALL_TABLES];
    const s = new Set();
    mods.forEach(m => (BACKUP_MODULES.find(b => b.id === m)?.tables || []).forEach(t => s.add(t)));
    return [...s];
  };

  // ── YEDEK AL ───────────────────────────────────────────────
  const handleBackup = async () => {
    setProcessing(true); setError(null); setResult(null);
    const tables = backupType === 'full' ? ALL_TABLES : getTablesForModules(selectedModules);
    if (tables.length === 0) { setError('En az bir modül seçin.'); setProcessing(false); return; }
    const includeMedia = tables.includes('media');

    try {
      const zip = new JSZip();
      const dbFolder = zip.folder('veritabani');
      const manifest = { version: '2.0', created_at: new Date().toISOString(), type: backupType, tables: [], stats: {} };
      let totalRows = 0;

      // Her tabloyu çek
      for (const t of tables) {
        setProgress(`📦 ${t} tablosu çekiliyor...`);
        try {
          const rows = await fetchTable(t, setProgress);
          dbFolder.file(`${t}.json`, JSON.stringify(rows, null, 2));
          manifest.tables.push(t);
          manifest.stats[t] = rows.length;
          totalRows += rows.length;
        } catch (e) {
          console.warn(`${t} atlandı:`, e.message);
          manifest.stats[t] = `HATA: ${e.message}`;
        }
      }

      // Medya dosyaları
      let mediaCount = 0;
      if (includeMedia) {
        const mediaJson = dbFolder.file('media.json');
        if (mediaJson) {
          const mediaRows = JSON.parse(await mediaJson.async('string'));
          if (mediaRows.length > 0) {
            const mediaFolder = zip.folder('medya_dosyalari');
            for (let i = 0; i < mediaRows.length; i++) {
              const m = mediaRows[i];
              if (!m.file_key) continue;
              setProgress(`🖼️ Medya ${i + 1}/${mediaRows.length}: ${m.name || m.file_key}...`);
              const blob = await fetchMediaBlob(m.file_key);
              if (blob && blob.size > 0) {
                const safeName = m.file_key.replace(/\//g, '_');
                mediaFolder.file(safeName, blob);
                mediaCount++;
              }
            }
          }
        }
      }

      manifest.total_rows = totalRows;
      manifest.media_files = mediaCount;
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      setProgress('📁 ZIP dosyası oluşturuluyor...');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => setProgress(`📁 ZIP: %${Math.round(meta.percent)}...`));

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `AERP_Yedek_${backupType === 'full' ? 'TAM' : 'PARCALI'}_${dateStr}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);

      const sizeMB = (blob.size / 1048576).toFixed(1);
      setResult({ type: 'backup', fileName, tables: manifest.tables.length, totalRows, mediaFiles: mediaCount, size: `${sizeMB} MB` });
    } catch (e) {
      setError('Yedekleme hatası: ' + e.message);
    } finally { setProcessing(false); setProgress(''); }
  };

  // ── ZIP DOSYA YÜKLE ────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    try {
      setProgress('📂 ZIP okunuyor...');
      const z = await JSZip.loadAsync(file);
      const mf = z.file('manifest.json');
      if (!mf) throw new Error('Geçersiz yedek — manifest.json bulunamadı.');
      const manifest = JSON.parse(await mf.async('string'));
      setRestoreZip(z); setRestoreFile(file.name);
      const mediaFolder = z.folder('medya_dosyalari');
      const mediaCount = mediaFolder ? Object.keys(mediaFolder.files).filter(f => !f.endsWith('/')).length : 0;
      setRestoreInfo({
        created: manifest.created_at, tables: manifest.tables?.length || 0,
        totalRows: manifest.total_rows || 0, mediaFiles: mediaCount,
        availableModules: BACKUP_MODULES.filter(m => m.tables.some(t => manifest.tables?.includes(t))),
      });
      setResult({ type: 'loaded' });
    } catch (err) { setError('Dosya okunamadı: ' + err.message); setRestoreZip(null); }
    finally { setProgress(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  // ── GERİ YÜKLE ────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restoreZip) { setError('Önce bir ZIP yedek dosyası yükleyin.'); return; }
    const tables = restoreType === 'full' ? ALL_TABLES : getTablesForModules(restoreModules);
    if (tables.length === 0) { setError('En az bir modül seçin.'); return; }
    if (!window.confirm('⚠ Seçili verilerin TAMAMI silinip yedekten geri yüklenecek. Devam?')) return;
    if (!window.confirm('Son onay — bu işlem GERİ ALINAMAZ!')) return;

    setProcessing(true); setError(null); setResult(null);
    const log = [];

    try {
      // 1) Ters sırada sil
      const delTables = DELETE_ORDER.filter(t => tables.includes(t));
      for (const t of delTables) {
        setProgress(`🗑️ ${t} siliniyor...`);
        try { await supabase.from(t).delete().neq('id', '___x___'); } catch {}
      }

      // 2) Doğru sırada ekle
      const insTables = ALL_TABLES.filter(t => tables.includes(t));
      let totalInserted = 0;
      for (const t of insTables) {
        const f = restoreZip.file(`veritabani/${t}.json`);
        if (!f) { log.push({ table: t, status: 'skipped' }); continue; }
        const rows = JSON.parse(await f.async('string'));
        if (rows.length === 0) { log.push({ table: t, status: 'skipped' }); continue; }
        setProgress(`📥 ${t}: ${rows.length} kayıt yükleniyor...`);
        let ins = 0, errs = [];
        for (let i = 0; i < rows.length; i += 50) {
          const chunk = rows.slice(i, i + 50);
          const { error: e } = await supabase.from(t).upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
          if (e) { for (const r of chunk) { const { error: e2 } = await supabase.from(t).upsert(r, { onConflict: 'id' }); if (e2) errs.push(e2.message); else ins++; } }
          else ins += chunk.length;
        }
        totalInserted += ins;
        log.push({ table: t, status: 'ok', inserted: ins, total: rows.length, errors: errs.length > 0 ? errs.slice(0, 3) : undefined });
      }

      // 3) Medya dosyalarını B2'ye yükle
      if (tables.includes('media')) {
        const mf = restoreZip.folder('medya_dosyalari');
        if (mf) {
          const files = Object.keys(mf.files).filter(f => !f.endsWith('/'));
          let uploaded = 0;
          for (let i = 0; i < files.length; i++) {
            const fPath = files[i];
            const fName = fPath.split('/').pop();
            const originalKey = fName.replace(/^uploads_/, 'uploads/');
            setProgress(`🖼️ Medya ${i + 1}/${files.length}: ${fName}...`);
            try {
              const blob = await mf.files[fPath].async('blob');
              const base64 = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });
              await fetch('/api/media', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: fName, mimeType: blob.type || 'application/octet-stream', fileSize: blob.size, fileData: base64, name: fName }),
              });
              uploaded++;
            } catch {}
          }
          log.push({ table: 'medya_b2', status: 'ok', inserted: uploaded, total: files.length });
        }
      }

      setResult({ type: 'restore', log, totalInserted, hasErrors: log.some(l => l.errors?.length > 0) });
      setRestoreZip(null); setRestoreFile(null); setRestoreInfo(null);
    } catch (e) { setError('Geri yükleme hatası: ' + e.message); }
    finally { setProcessing(false); setProgress(''); }
  };

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-6" style={{ background: c.card, border: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl" style={{ background: 'rgba(139,92,246,0.12)' }}><HardDrive size={22} style={{ color: '#8b5cf6' }} /></div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: c.text }}>Yedekleme & Geri Yükleme</h2>
          <p className="text-sm mt-0.5" style={{ color: c.muted }}>ZIP dosyası olarak tam/parçalı yedek alın, medya dosyaları dahil.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* YEDEK AL */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-2"><FileDown size={18} style={{ color: '#10b981' }} /><h3 className="text-sm font-bold" style={{ color: c.text }}>Yedek Al</h3></div>
          <div className="flex gap-2">
            {[{ id: 'full', label: 'Tam Yedek' }, { id: 'partial', label: 'Parçalı' }].map(t => (
              <button key={t.id} onClick={() => setBackupType(t.id)} className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: backupType === t.id ? `${currentColor}15` : 'transparent', color: backupType === t.id ? currentColor : c.muted, border: `1px solid ${backupType === t.id ? `${currentColor}40` : c.border}` }}>{t.label}</button>
            ))}
          </div>
          {backupType === 'partial' && (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {BACKUP_MODULES.map(mod => (
                <label key={mod.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer" onClick={() => toggle(mod.id, setSelectedModules)}
                  style={{ background: selectedModules.includes(mod.id) ? `${currentColor}10` : 'transparent', border: `1px solid ${selectedModules.includes(mod.id) ? `${currentColor}30` : 'transparent'}` }}>
                  <input type="checkbox" checked={selectedModules.includes(mod.id)} readOnly style={{ accentColor: currentColor }} />
                  <span className="text-sm">{mod.icon}</span>
                  <div className="flex-1 min-w-0"><p className="text-xs font-semibold" style={{ color: c.text }}>{mod.label}</p><p className="text-[10px]" style={{ color: c.muted }}>{mod.tables.join(', ')}</p></div>
                  {mod.heavy && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#f59e0b20', color: '#f59e0b' }}>Büyük</span>}
                </label>
              ))}
            </div>
          )}
          <button onClick={handleBackup} disabled={processing} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: processing ? '#64748b' : '#10b981' }}>
            {processing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {processing ? 'Yedekleniyor...' : backupType === 'full' ? 'Tam Yedek Al (.zip)' : `${selectedModules.length} Modül Yedekle`}
          </button>
        </div>

        {/* GERİ YÜKLE */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-2"><FileUp size={18} style={{ color: '#3b82f6' }} /><h3 className="text-sm font-bold" style={{ color: c.text }}>Geri Yükle</h3></div>
          <input ref={fileRef} type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={processing} className="w-full py-3 rounded-xl text-xs font-semibold border-2 border-dashed"
            style={{ borderColor: restoreFile ? '#10b981' : c.border, color: restoreFile ? '#10b981' : c.muted, background: restoreFile ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
            {restoreFile ? <span className="flex items-center justify-center gap-2"><CheckCircle2 size={14} />{restoreFile}</span> : <span className="flex items-center justify-center gap-2"><Upload size={14} />Yedek dosyası seçin (.zip)</span>}
          </button>
          {restoreInfo && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[{ l: 'Tablolar', v: restoreInfo.tables }, { l: 'Kayıt', v: restoreInfo.totalRows }, { l: 'Medya', v: restoreInfo.mediaFiles }].map((s, i) => (
                  <div key={i} className="px-2 py-1.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${c.border}` }}>
                    <p className="text-[10px] font-bold" style={{ color: c.muted }}>{s.l}</p><p className="text-xs font-bold" style={{ color: c.text }}>{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {[{ id: 'full', label: 'Tam Yükle' }, { id: 'partial', label: 'Parçalı' }].map(t => (
                  <button key={t.id} onClick={() => setRestoreType(t.id)} className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={{ background: restoreType === t.id ? `${currentColor}15` : 'transparent', color: restoreType === t.id ? currentColor : c.muted, border: `1px solid ${restoreType === t.id ? `${currentColor}40` : c.border}` }}>{t.label}</button>
                ))}
              </div>
              {restoreType === 'partial' && restoreInfo.availableModules && (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {restoreInfo.availableModules.map(mod => (
                    <label key={mod.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer" onClick={() => toggle(mod.id, setRestoreModules)}
                      style={{ background: restoreModules.includes(mod.id) ? `${currentColor}10` : 'transparent' }}>
                      <input type="checkbox" checked={restoreModules.includes(mod.id)} readOnly style={{ accentColor: currentColor }} />
                      <span className="text-sm">{mod.icon}</span><p className="text-xs font-semibold flex-1" style={{ color: c.text }}>{mod.label}</p>
                    </label>
                  ))}
                </div>
              )}
              <button onClick={handleRestore} disabled={processing} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: processing ? '#64748b' : '#ef4444' }}>
                {processing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                {processing ? 'Yükleniyor...' : restoreType === 'full' ? '⚠ Tam Geri Yükle' : `⚠ ${restoreModules.length} Modül Yükle`}
              </button>
            </>
          )}
        </div>
      </div>

      {progress && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: `${currentColor}08`, border: `1px solid ${currentColor}20` }}>
        <Loader2 size={16} className="animate-spin" style={{ color: currentColor }} /><p className="text-sm font-semibold" style={{ color: currentColor }}>{progress}</p>
      </motion.div>}

      {error && <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} /><p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{error}</p>
      </div>}

      {result?.type === 'backup' && <div className="rounded-2xl p-5 space-y-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="flex items-center gap-2"><CheckCircle2 size={18} style={{ color: '#10b981' }} /><p className="text-sm font-bold" style={{ color: '#10b981' }}>Yedekleme Tamamlandı!</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[{ l: 'Dosya', v: result.fileName },{ l: 'Tablolar', v: result.tables },{ l: 'Kayıt', v: result.totalRows },{ l: 'Boyut', v: result.size },
            ...(result.mediaFiles > 0 ? [{ l: 'Medya', v: result.mediaFiles }] : [])].map((s, i) => (
            <div key={i} className="px-3 py-2 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${c.border}` }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: c.muted }}>{s.l}</p><p className="text-xs font-bold mt-0.5 truncate" style={{ color: c.text }}>{s.v}</p>
            </div>))}
        </div>
      </div>}

      {result?.type === 'restore' && <div className="rounded-2xl p-5 space-y-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="flex items-center gap-2"><CheckCircle2 size={18} style={{ color: result.hasErrors ? '#f59e0b' : '#10b981' }} />
          <p className="text-sm font-bold" style={{ color: result.hasErrors ? '#f59e0b' : '#10b981' }}>Geri Yükleme {result.hasErrors ? 'Kısmen ' : ''}Tamamlandı — {result.totalInserted} kayıt</p></div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {result.log.map((e, i) => <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${c.border}` }}>
            <span className="font-mono font-bold" style={{ color: c.text }}>{e.table}</span>
            <span style={{ color: e.status === 'ok' ? '#10b981' : c.muted }}>{e.status === 'ok' ? `✓ ${e.inserted}/${e.total}` : '— atlandı'}{e.errors?.length > 0 && ` ⚠${e.errors.length}`}</span>
          </div>)}
        </div>
      </div>}

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(245,158,11,0.06)' : '#fffbeb', border: '1px solid rgba(245,158,11,0.15)' }}>
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
        <div><p className="text-xs font-bold" style={{ color: '#f59e0b' }}>Önemli</p>
          <ul className="text-[11px] mt-1 space-y-0.5 list-disc list-inside" style={{ color: c.muted }}>
            <li>Yedek ZIP olarak indirilir — veritabanı + medya dosyaları dahil</li>
            <li>Geri yükleme mevcut verileri <strong>siler</strong> ve yedekten yazar</li>
            <li>İstemci taraflı çalışır — sunucu timeout sorunu yok</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
