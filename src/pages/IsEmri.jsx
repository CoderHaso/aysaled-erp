import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer, Plus, Search, X, Loader2, ChevronDown, ChevronUp,
  Check, Clock, CheckCircle2, XCircle, AlertCircle, Package,
  User, Calendar, RefreshCw, Zap, FlaskConical, Edit3,
  StickyNote, History, Activity, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { pageCache } from '../lib/pageCache';
import RecipePickerModal from '../components/RecipePickerModal';

// ── Durumlar ──────────────────────────────────────────────────────────────────
const STATUS = {
  pending:     { label: 'Bekliyor',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Clock        },
  in_progress: { label: 'Üretimde',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: Zap          },
  completed:   { label: 'Tamamlandı', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  cancelled:   { label: 'İptal',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle      },
};

const fmt  = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 });
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const today = () => new Date().toISOString().slice(0,16);

// ── İş Emri Oluşturma Modal ───────────────────────────────────────────────────
function WorkOrderForm({ items, orders, allRecipes, onClose, onSaved, currentColor, isDark }) {
  const [form, setForm] = useState({
    item_id:'', recipe_id:'', recipe_key:'', recipe_note:'',
    order_id:'', quantity:1, notes:'', started_at:today(),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [itemQ, setItemQ] = useState('');
  const [itemOpen, setItemOpen] = useState(false);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  const selectedItem  = items.find(i => i.id === form.item_id);
  const itemMatches   = items.filter(i => i.item_type === 'product' && (!itemQ || i.name.toLowerCase().includes(itemQ.toLowerCase()))).slice(0,8);
  const productRecipes = (allRecipes||[]).filter(r => r.product_id === form.item_id);
  const hasRecipe     = form.item_id && productRecipes.length > 0;

  const handleSave = async () => {
    if (!form.item_id) return setErr('Ürün seçilmeli');
    if (!form.quantity) return setErr('Miktar girilmeli');
    setSaving(true); setErr('');
    try {
      const payload = {
        item_id: form.item_id, quantity: Number(form.quantity), status: 'pending',
        notes: [form.recipe_note, form.notes].filter(Boolean).join(' | ') || null,
        started_at: form.started_at || null, line_key: '',
      };
      if (form.order_id) payload.order_id = form.order_id;
      if (form.recipe_id) payload.recipe_id = form.recipe_id;
      const { error } = await supabase.from('work_orders').insert(payload);
      if (error) throw error;
      onSaved(); onClose();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const iS = {
    background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    borderColor: isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0',
    color: isDark ? '#f1f5f9' : '#1e293b',
  };
  const inp = 'w-full px-3 py-2 text-sm rounded-xl outline-none border';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{ opacity:0,scale:0.96 }} animate={{ opacity:1,scale:1 }}
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ background: isDark ? '#0f1e36' : '#ffffff', border:`1px solid ${currentColor}30` }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: isDark?'#f1f5f9':'#1e293b' }}>Yeni İş Emri</h2>
          <button onClick={onClose} style={{ color:'#64748b' }}><X size={18}/></button>
        </div>

        {/* Ürün */}
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Üretilecek Ürün *</p>
          <button className={`${inp} flex items-center justify-between`} style={iS} onClick={() => setItemOpen(v => !v)}>
            <span style={{ color: selectedItem ? iS.color : '#94a3b8' }}>{selectedItem?.name || 'Ürün seçin...'}</span>
            <ChevronDown size={14}/>
          </button>
          {itemOpen && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
              style={{ background: isDark?'#1e293b':'#ffffff', border:`1px solid ${isDark?'rgba(148,163,184,0.15)':'#e2e8f0'}` }}>
              <div className="p-2">
                <input autoFocus className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={iS}
                  placeholder="Ürün ara..." value={itemQ} onChange={e => setItemQ(e.target.value)}/>
              </div>
              {itemMatches.map(i => (
                <button key={i.id} className="w-full text-left px-4 py-2.5 text-sm hover:opacity-80"
                  style={{ color: isDark?'#f1f5f9':'#1e293b', borderTop:`1px solid ${isDark?'rgba(148,163,184,0.08)':'#f1f5f9'}` }}
                  onClick={() => { setForm(f => ({...f, item_id:i.id, recipe_id:'', recipe_key:'', recipe_note:''})); setItemOpen(false); setItemQ(''); }}>
                  {i.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reçete */}
        {hasRecipe && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Reçete (opsiyonel)</p>
            <button className={`${inp} flex items-center justify-between`} style={iS} onClick={() => setShowRecipePicker(true)}>
              <span style={{ color: form.recipe_key ? '#a78bfa' : '#94a3b8' }}>
                {form.recipe_key ? `📋 ${form.recipe_key}` : 'Reçete seçin...'}
              </span>
              <FlaskConical size={13} style={{ color:'#a78bfa' }}/>
            </button>
          </div>
        )}

        {/* Sipariş */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sipariş (opsiyonel)</p>
          <select className={inp} style={iS} value={form.order_id} onChange={e => setForm(f => ({...f, order_id:e.target.value}))}>
            <option value="">— Bağımsız İş Emri —</option>
            {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').map(o => (
              <option key={o.id} value={o.id}>#{o.order_number} · {o.customer_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Miktar *</p>
            <input type="number" min={1} className={inp} style={iS}
              value={form.quantity} onChange={e => setForm(f => ({...f, quantity:e.target.value}))}/>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Başlangıç</p>
            <input type="datetime-local" className={inp} style={iS}
              value={form.started_at} onChange={e => setForm(f => ({...f, started_at:e.target.value}))}/>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Not</p>
          <textarea className={`${inp} resize-none`} style={iS} rows={2}
            placeholder="Özel talimatlar..." value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))}/>
        </div>

        {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12}/>{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm"
            style={{ background: isDark?'rgba(255,255,255,0.05)':'#f1f5f9', border:`1px solid ${isDark?'rgba(148,163,184,0.15)':'#e2e8f0'}`, color: isDark?'#94a3b8':'#64748b' }}>
            İptal
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: currentColor }}>
            {saving ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Emri Kaydet'}
          </button>
        </div>
      </motion.div>

      {showRecipePicker && (
        <RecipePickerModal productId={form.item_id} productName={selectedItem?.name||''}
          allRecipes={allRecipes} allItems={items} currentColor={currentColor}
          selectedRecipeId={form.recipe_id || null}
          onClose={() => setShowRecipePicker(false)}
          onSelect={(rec) => { setForm(f => ({...f, recipe_id:rec.recipe_id||'', recipe_key:rec.recipe_key||'', recipe_note:rec.recipe_note||''})); setShowRecipePicker(false); }}/>
      )}
    </div>
  );
}

// ── İş Emri Kartı ─────────────────────────────────────────────────────────────
function WorkOrderCard({ wo, items, orders, allRecipes, onStatusChange, onDelete, currentColor }) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';
  const [changing, setChanging]     = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [noteInput, setNoteInput]   = useState(wo.production_note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  const item   = items.find(i => i.id === wo.item_id);
  const order  = orders.find(o => o.id === wo.order_id);
  const s      = STATUS[wo.status] || STATUS.pending;
  const Icon   = s.icon;
  const recipe = (allRecipes||[]).find(r => r.id === wo.recipe_id);

  const handleStatus = async (newStatus) => {
    setChanging(true);
    const patch = { status: newStatus };
    if (newStatus === 'in_progress' && !wo.started_at) patch.started_at = new Date().toISOString();
    if (newStatus === 'completed') patch.completed_at = new Date().toISOString();
    if (newStatus === 'completed' && noteInput.trim()) patch.production_note = noteInput.trim();
    await supabase.from('work_orders').update(patch).eq('id', wo.id);

    if (newStatus === 'completed') {
      const recipeId = wo.recipe_id || null;
      const woQty    = Number(wo.quantity || 1);
      const woNote   = `İş emri #${wo.id?.slice(0,8)} (${item?.name||''}) tamamlandı${noteInput.trim() ? ` | Not: ${noteInput.trim()}` : ''}`;

      await supabase.rpc('increment_stock', {
        p_item_id: wo.item_id, p_qty: woQty, p_source: 'work_order',
        p_source_id: wo.id, p_recipe_id: recipeId, p_note: woNote,
      });

      const recipeQuery = supabase.from('product_recipes').select('id, recipe_items(item_id, quantity)').eq('product_id', wo.item_id);
      if (recipeId) recipeQuery.eq('id', recipeId); else recipeQuery.limit(1);
      let recipeData = null;
      try { const res = await recipeQuery.maybeSingle(); recipeData = res?.data; } catch(_) {}

      for (const ri of (recipeData?.recipe_items || [])) {
        if (!ri.item_id) continue;
        const qty = Number(ri.quantity || 1) * woQty;
        await supabase.rpc('decrement_stock', {
          p_item_id: ri.item_id, p_qty: qty, p_source: 'work_order',
          p_source_id: wo.id, p_note: `${woNote} — hammadde`,
        });
      }
    }

    pageCache.invalidate('stock_items');
    onStatusChange();
    setChanging(false);
  };

  const saveNote = async () => {
    if (noteInput === (wo.production_note||'')) return;
    setSavingNote(true);
    await supabase.from('work_orders').update({ production_note: noteInput.trim() }).eq('id', wo.id);
    setSavingNote(false);
  };

  const handleRecipeUpdate = async (rec) => {
    const changeNote = `Reçete: ${rec.recipe_key || rec.recipe_id}`;
    await supabase.from('work_orders').update({ recipe_id: rec.recipe_id||null, recipe_change_note: changeNote }).eq('id', wo.id);
    if (wo.order_id) {
      const { data: ord } = await supabase.from('orders').select('notes').eq('id', wo.order_id).maybeSingle();
      const prev = ord?.notes || '';
      await supabase.from('orders').update({ notes: prev ? `${prev} | ${changeNote}` : changeNote }).eq('id', wo.order_id);
    }
    setShowRecipePicker(false);
    onStatusChange();
  };

  const nextStatuses = ({ pending:['in_progress','cancelled'], in_progress:['completed','cancelled'], completed:[], cancelled:['pending'] }[wo.status] || []);
  const btnColor = ns => ({ in_progress:'#3b82f6', completed:'#10b981', cancelled:'#ef4444', pending:'#f59e0b' }[ns] || '#94a3b8');
  const BtnStyle = col => ({
    background: `linear-gradient(135deg,${col}12,${col}25)`,
    color: col, border: `1px solid ${col}40`,
    boxShadow: `0 2px 6px ${col}18`, transition: 'all 0.15s ease',
  });

  return (
    <motion.div initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: isDark?'rgba(255,255,255,0.03)':'#fafbfc', border:`1px solid ${s.color}25` }}>

      {/* Başlık */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
              style={{ background:s.bg, color:s.color }}><Icon size={10}/> {s.label}</span>
            {wo.status==='in_progress' && <span className="text-[10px] text-blue-400 animate-pulse font-bold">⚡ AKTİF</span>}
          </div>
          <p className="text-sm font-bold truncate" style={{ color: isDark?'#f1f5f9':'#1e293b' }}>{item?.name||'Bilinmeyen Ürün'}</p>
          <p className="text-[11px]" style={{ color:'#64748b' }}>{fmt(wo.quantity)} {item?.unit||'Adet'} üretim</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-mono" style={{ color:'#64748b' }}>#{wo.id?.slice(0,6).toUpperCase()}</p>
          <p className="text-[10px] mt-0.5" style={{ color:'#64748b' }}>{fmtD(wo.started_at)}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="px-4 pb-2 space-y-2">
        {/* Tamamlanma tarihi */}
        {wo.completed_at && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-500">
            <CheckCircle2 size={10} className="shrink-0"/>
            <span>Bitti: {fmtD(wo.completed_at)}</span>
          </div>
        )}

        {/* Üretim notu — tamamlananlar için göster */}
        {wo.status === 'completed' && wo.production_note && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
            style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)' }}>
            <StickyNote size={11} style={{ color:'#10b981', marginTop:1, flexShrink:0 }}/>
            <p className="text-[11px] italic" style={{ color: isDark?'#6ee7b7':'#059669' }}>{wo.production_note}</p>
          </div>
        )}

        {/* Reçete accordion */}
        {recipe && (
          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid rgba(139,92,246,0.2)' }}>
            <button className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold"
              style={{ background:'rgba(139,92,246,0.06)', color:'#a78bfa' }}
              onClick={() => setRecipeOpen(v => !v)}>
              <span className="flex items-center gap-1.5"><FlaskConical size={11}/> {recipe.name}</span>
              {recipeOpen ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
            </button>
            {recipeOpen && (
              <div className="px-3 py-2 space-y-1" style={{ background: isDark?'rgba(139,92,246,0.03)':'rgba(139,92,246,0.02)' }}>
                {(recipe.recipe_items||[]).map((ri,i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]" style={{ color:'#94a3b8' }}>
                    <span>• {ri.item_name}</span>
                    <span className="font-bold">{ri.quantity} {ri.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reçete değişiklik notu */}
        {wo.recipe_change_note && (
          <p className="text-[10px] px-2 py-1 rounded-lg" style={{ color:'#f59e0b', background:'rgba(245,158,11,0.08)' }}>
            🔄 {wo.recipe_change_note}
          </p>
        )}

        {/* Üretim notu girişi (sadece üretimdeyken) */}
        {wo.status === 'in_progress' && (
          <div>
            <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} onBlur={saveNote}
              rows={2} placeholder="Üretim notu (opsiyonel)…"
              className="w-full text-[11px] px-3 py-2 rounded-xl resize-none outline-none"
              style={{ background: isDark?'rgba(255,255,255,0.05)':'#f8fafc', border:`1px solid ${isDark?'rgba(148,163,184,0.12)':'#e2e8f0'}`, color: isDark?'#cbd5e1':'#475569' }}/>
            {savingNote && <p className="text-[10px] text-blue-400">Kaydediliyor...</p>}
          </div>
        )}
      </div>

      {/* Aksiyonlar */}
      <div className="flex gap-2 flex-wrap px-4 pb-4">
        {nextStatuses.map(ns => {
          const col = btnColor(ns);
          const labels = { in_progress:'Üretime Başla', completed:'Tamamlandı', cancelled:'İptal Et', pending:'Beklet' };
          return (
            <button key={ns} onClick={() => handleStatus(ns)} disabled={changing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
              style={BtnStyle(col)}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform='none'}>
              {changing ? <Loader2 size={10} className="animate-spin"/> : <Check size={10}/>}
              {labels[ns]||ns}
            </button>
          );
        })}
        {wo.status==='in_progress' && item && (allRecipes||[]).some(r => r.product_id===wo.item_id) && (
          <button onClick={() => setShowRecipePicker(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold"
            style={{ background:'rgba(139,92,246,0.1)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.25)' }}>
            <Edit3 size={10}/> Reçete Güncelle
          </button>
        )}
        {wo.status==='cancelled' && (
          <button onClick={() => onDelete(wo.id)}
            className="px-3 py-2 rounded-xl text-[11px] font-semibold"
            style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
            Sil
          </button>
        )}
      </div>

      {showRecipePicker && (
        <RecipePickerModal productId={wo.item_id} productName={item?.name||''}
          allRecipes={allRecipes||[]} allItems={items||[]} currentColor={currentColor}
          selectedRecipeId={wo.recipe_id}
          onClose={() => setShowRecipePicker(false)} onSelect={handleRecipeUpdate}/>
      )}
    </motion.div>
  );
}

// ── Sipariş Grubu Kartı (kapanır/açılır) ────────────────────────────────────
function OrderGroup({ orderId, wos, order, items, allRecipes, onStatusChange, onDelete, currentColor, isDark }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount    = wos.filter(w => w.status==='in_progress').length;
  const completedCount = wos.filter(w => w.status==='completed').length;
  const totalCount     = wos.length;

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      className="rounded-2xl overflow-hidden"
      style={{ border:'1.5px solid rgba(59,130,246,0.25)', background: isDark?'rgba(59,130,246,0.03)':'rgba(59,130,246,0.02)' }}>

      {/* Grup başlığı — tıklanabilir */}
      <button className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
        style={{ borderBottom: collapsed?'none':'1px solid rgba(59,130,246,0.15)', background:'rgba(59,130,246,0.07)' }}
        onClick={() => setCollapsed(v => !v)}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background:'rgba(59,130,246,0.18)' }}>
          <Package size={13} style={{ color:'#3b82f6' }}/>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-bold" style={{ color:'#3b82f6' }}>
            Sipariş #{order?.order_number || orderId.slice(0,8)}
          </p>
          {order?.customer_name && (
            <p className="text-[10px]" style={{ color:'#64748b' }}>{order.customer_name}</p>
          )}
        </div>
        {/* Sayaçlar */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
              style={{ background:'rgba(59,130,246,0.15)', color:'#3b82f6' }}>
              {activeCount} aktif
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background:'rgba(59,130,246,0.1)', color:'#3b82f6' }}>
            {completedCount}/{totalCount}
          </span>
          {collapsed ? <ChevronDown size={14} style={{ color:'#3b82f6' }}/> : <ChevronUp size={14} style={{ color:'#3b82f6' }}/>}
        </div>
      </button>

      {/* WO kartları */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2, ease:'easeInOut' }}
            className="overflow-hidden">
            <div className="p-3 space-y-3">
              {wos.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} items={items} orders={[order||{}]}
                  allRecipes={allRecipes} onStatusChange={onStatusChange}
                  onDelete={onDelete} currentColor={currentColor}/>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function IsEmri() {
  const { currentColor, effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [workOrders, setWorkOrders] = useState([]);
  const [items,      setItems]      = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [tab,        setTab]        = useState('active'); // active | history | cancelled

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [woRes, itemRes, ordRes, recRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('created_at', { ascending:false }),
      supabase.from('items').select('id, name, unit, item_type, stock_count, category').eq('is_active', true),
      supabase.from('orders').select('id, order_number, customer_name, status').order('created_at', { ascending:false }).limit(200),
      supabase.from('product_recipes').select('id, product_id, name, tags, recipe_items(id, item_id, item_name, quantity, unit)').order('name'),
    ]);
    setWorkOrders(woRes.data || []);
    setItems(itemRes.data || []);
    setOrders(ordRes.data || []);
    setAllRecipes(recRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = async (id) => {
    await supabase.from('work_orders').delete().eq('id', id);
    setWorkOrders(ws => ws.filter(w => w.id !== id));
  };

  // Sekme filtreleme
  const tabFilter = wo => {
    if (tab === 'active')    return wo.status === 'pending' || wo.status === 'in_progress';
    if (tab === 'history')   return wo.status === 'completed';
    if (tab === 'cancelled') return wo.status === 'cancelled';
    return true;
  };

  const filtered = workOrders.filter(wo => {
    if (!tabFilter(wo)) return false;
    if (!search) return true;
    const item = items.find(i => i.id === wo.item_id);
    const ord  = orders.find(o => o.id === wo.order_id);
    return item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      ord?.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      ord?.order_number?.toLowerCase().includes(search.toLowerCase());
  });

  const counts = {
    active:    workOrders.filter(w => w.status==='pending'||w.status==='in_progress').length,
    history:   workOrders.filter(w => w.status==='completed').length,
    cancelled: workOrders.filter(w => w.status==='cancelled').length,
  };

  // Sipariş bazlı gruplama
  const groupedByOrder = {};
  const independent = [];
  filtered.forEach(wo => {
    if (wo.order_id) {
      if (!groupedByOrder[wo.order_id]) groupedByOrder[wo.order_id] = [];
      groupedByOrder[wo.order_id].push(wo);
    } else {
      independent.push(wo);
    }
  });
  const orderGroups = Object.entries(groupedByOrder);

  const TABS = [
    { id:'active',    label:'Aktif',        icon:Activity,  count:counts.active    },
    { id:'history',   label:'Tamamlananlar', icon:History,   count:counts.history   },
    { id:'cancelled', label:'İptal',         icon:XCircle,   count:counts.cancelled },
  ];

  return (
    <div className="flex flex-col h-full" style={{ color: isDark?'#f1f5f9':'#1e293b' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:`${currentColor}20` }}>
              <Hammer size={18} style={{ color:currentColor }}/>
            </div>
            <div>
              <h1 className="text-lg font-bold">İş Emirleri</h1>
              <p className="text-xs" style={{ color:'#64748b' }}>Atölye Üretim Takibi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 rounded-xl" style={{ color:'#94a3b8' }}>
              <RefreshCw size={15}/>
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background:currentColor }}>
              <Plus size={14}/> Yeni İş Emri
            </button>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark?'rgba(255,255,255,0.04)':'#f1f5f9' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: active ? (isDark?'rgba(255,255,255,0.08)':'#ffffff') : 'transparent',
                  color: active ? currentColor : '#64748b',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                <Icon size={12}/>
                {t.label}
                {t.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                    style={{ background: active ? `${currentColor}20` : (isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'), color: active ? currentColor : '#64748b' }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Arama */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: isDark?'rgba(255,255,255,0.04)':'#f8fafc', border:`1px solid ${isDark?'rgba(148,163,184,0.1)':'#e2e8f0'}` }}>
          <Search size={13} style={{ color:'#94a3b8' }} className="shrink-0"/>
          <input className="flex-1 bg-transparent text-sm outline-none" style={{ color: isDark?'#f1f5f9':'#1e293b' }}
            placeholder="Ürün adı veya müşteri ara…" value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color:'#94a3b8' }}/></button>}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 size={20} className="animate-spin" style={{ color:currentColor }}/>
            <span className="text-sm" style={{ color:'#64748b' }}>Yükleniyor…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <Hammer size={38} className="mx-auto mb-3 opacity-20" style={{ color:'#94a3b8' }}/>
            <p className="text-sm" style={{ color:'#64748b' }}>
              {tab === 'active'    ? 'Aktif iş emri yok' :
               tab === 'history'  ? 'Tamamlanan iş emri yok' :
               tab === 'cancelled' ? 'İptal edilen iş emri yok' : 'İş emri yok'}
            </p>
            {tab === 'active' && (
              <button onClick={() => setShowForm(true)}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background:currentColor }}>
                İlk İş Emrini Oluştur
              </button>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {!loading && (
            <>
              {/* Sipariş bazlı gruplar */}
              {orderGroups.map(([orderId, wos]) => {
                const ord = orders.find(o => o.id === orderId);
                return (
                  <OrderGroup key={orderId} orderId={orderId} wos={wos} order={ord}
                    items={items} allRecipes={allRecipes}
                    onStatusChange={loadAll} onDelete={handleDelete}
                    currentColor={currentColor} isDark={isDark}/>
                );
              })}

              {/* Bağımsız iş emirleri */}
              {independent.length > 0 && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
                  {orderGroups.length > 0 && (
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px" style={{ background: isDark?'rgba(148,163,184,0.1)':'#e2e8f0' }}/>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#64748b' }}>Bağımsız İş Emirleri</span>
                      <div className="flex-1 h-px" style={{ background: isDark?'rgba(148,163,184,0.1)':'#e2e8f0' }}/>
                    </div>
                  )}
                  <div className="space-y-3">
                    {independent.map(wo => (
                      <WorkOrderCard key={wo.id} wo={wo} items={items} orders={orders}
                        allRecipes={allRecipes} onStatusChange={loadAll}
                        onDelete={handleDelete} currentColor={currentColor}/>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      {showForm && (
        <WorkOrderForm items={items} orders={orders} allRecipes={allRecipes}
          currentColor={currentColor} isDark={isDark}
          onClose={() => setShowForm(false)} onSaved={loadAll}/>
      )}
    </div>
  );
}
