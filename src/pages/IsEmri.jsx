import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer, Plus, Search, X, Loader2, ChevronDown, Check,
  Clock, CheckCircle2, XCircle, AlertCircle, Package,
  User, Calendar, RefreshCw, Zap, FlaskConical, BookOpen,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import RecipePickerModal from '../components/RecipePickerModal';

const STATUS = {
  pending:     { label: 'Bekliyor',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Clock        },
  in_progress: { label: 'Üretimde',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: Zap          },
  completed:   { label: 'Tamamlandı',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  cancelled:   { label: 'İptal',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle      },
};

const fmt  = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 });
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const today = () => new Date().toISOString().slice(0, 16);

// ── İş Emri Oluşturma Modal ───────────────────────────────────────────────────
function WorkOrderForm({ items, orders, allBom, onClose, onSaved, currentColor }) {
  const [form, setForm] = useState({
    item_id:    '',
    recipe_key: '',
    recipe_note:'',
    recipe_components: [],
    order_id:   '',
    quantity:   1,
    notes:      '',
    started_at: today(),
  });
  const [saving, setSaving]             = useState(false);
  const [err, setErr]                   = useState('');
  const [itemQ, setItemQ]               = useState('');
  const [itemOpen, setItemOpen]         = useState(false);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  const selectedItem = items.find(i => i.id === form.item_id);
  const itemMatches  = items.filter(i =>
    i.item_type === 'product' &&
    (!itemQ || i.name.toLowerCase().includes(itemQ.toLowerCase()))
  ).slice(0, 8);
  const hasRecipe = form.item_id && (allBom || []).some(r => r.parent_id === form.item_id);

  const handleSave = async () => {
    if (!form.item_id)  return setErr('Ürün seçilmeli');
    if (!form.quantity) return setErr('Miktar girilmeli');
    setSaving(true); setErr('');
    try {
      const payload = {
        item_id:    form.item_id,
        quantity:   Number(form.quantity),
        status:     'pending',
        notes:      [form.recipe_note, form.notes].filter(Boolean).join(' | ') || null,
        started_at: form.started_at || null,
        line_key:   '',
      };
      if (form.order_id) payload.order_id = form.order_id;
      const { error } = await supabase.from('work_orders').insert(payload);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const inp = 'w-full px-3 py-2 text-sm rounded-xl outline-none';
  const iS  = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.18)', color: '#f1f5f9' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md rounded-2xl p-5 space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ background: '#0f1f38', border: '1px solid rgba(148,163,184,0.12)' }}>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Yeni İş Emri</p>
            <h3 className="text-sm font-bold text-white mt-0.5">Atölye Üretim Talebi</h3>
          </div>
          <button onClick={onClose}><X size={16} className="text-slate-500"/></button>
        </div>

        {/* Ürün */}
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Üretilecek Ürün *</p>
          <div onClick={() => setItemOpen(v => !v)}
            className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)' }}>
            <span className={`text-sm ${selectedItem ? 'text-slate-100' : 'text-slate-500'}`}>
              {selectedItem?.name || 'Mamül seç...'}
            </span>
            <ChevronDown size={14} className="text-slate-500"/>
          </div>
          <AnimatePresence>
            {itemOpen && (
              <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="absolute z-40 w-full mt-1 rounded-xl overflow-hidden"
                style={{ background: '#0c1a2e', border: '1px solid rgba(148,163,184,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                <div className="p-2">
                  <input autoFocus value={itemQ} onChange={e => setItemQ(e.target.value)}
                    placeholder="Ara..." className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#f1f5f9' }}/>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {itemMatches.map(i => (
                    <div key={i.id} onClick={() => { setForm(f => ({ ...f, item_id: i.id, recipe_id: '' })); setItemOpen(false); setItemQ(''); }}
                      className="px-4 py-2.5 cursor-pointer transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <p className="text-sm text-slate-100 font-semibold">{i.name}</p>
                      <p className="text-[10px] text-slate-500">Stok: {fmt(i.stock_count)} {i.unit}</p>
                    </div>
                  ))}
                  {itemMatches.length === 0 && <p className="px-4 py-3 text-xs text-slate-500">Sonuç yok</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reçete — RecipePickerModal */}
        {hasRecipe && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Reçete</p>
            <button onClick={() => setShowRecipePicker(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all"
              style={{
                background: form.recipe_note ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${form.recipe_note ? 'rgba(139,92,246,0.35)' : 'rgba(139,92,246,0.2)'}`,
                color: form.recipe_note ? '#c4b5fd' : '#64748b',
              }}>
              <span className="flex items-center gap-2 truncate">
                <FlaskConical size={13} style={{ color: '#a78bfa', flexShrink: 0 }}/>
                {form.recipe_note ? `✓ ${form.recipe_key}` : 'Reçete Seç...'}
              </span>
              <BookOpen size={12} style={{ color: '#a78bfa' }}/>
            </button>
            {form.recipe_note && (
              <p className="text-[10px] text-slate-600 mt-1 px-1 truncate">{form.recipe_note}</p>
            )}
          </div>
        )}
        {showRecipePicker && (
          <RecipePickerModal
            itemId={form.item_id}
            itemName={selectedItem?.name || ''}
            allBom={allBom || []}
            currentColor="#8b5cf6"
            onClose={() => setShowRecipePicker(false)}
            onSelect={rec => {
              setForm(f => ({ ...f, recipe_key: rec.recipe_key, recipe_note: rec.recipe_note }));
              setShowRecipePicker(false);
            }}/>
        )}

        {/* Sipariş bağlantısı */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Bağlı Sipariş (opsiyonel)</p>
          <select className={inp} style={iS}
            value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}>
            <option value="">— Siparişe bağlama —</option>
            {orders.filter(o => o.status !== 'cancelled').map(o => (
              <option key={o.id} value={o.id}>
                #{o.order_number} · {o.customer_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Miktar *</p>
            <input type="number" className={inp} style={iS} min="0.01" step="0.01"
              value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}/>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Başlangıç</p>
            <input type="datetime-local" className={inp} style={iS}
              value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))}/>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Not</p>
          <textarea className={`${inp} resize-none`} style={iS} rows={2}
            placeholder="Özel talimatlar..."
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
        </div>

        {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12}/>{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-slate-400"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.15)' }}>
            İptal
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: currentColor, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
            Oluştur
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── İş Emri Kartı ─────────────────────────────────────────────────────────────
function WorkOrderCard({ wo, items, orders, onStatusChange, onDelete, currentColor }) {
  const [changing, setChanging] = useState(false);
  const item  = items.find(i => i.id === wo.item_id);
  const order = orders.find(o => o.id === wo.order_id);
  const s     = STATUS[wo.status] || STATUS.pending;
  const Icon  = s.icon;

  const handleStatus = async (newStatus) => {
    setChanging(true);
    const patch = { status: newStatus };
    if (newStatus === 'in_progress' && !wo.started_at) patch.started_at = new Date().toISOString();
    if (newStatus === 'completed')  patch.completed_at = new Date().toISOString();
    await supabase.from('work_orders').update(patch).eq('id', wo.id);

    // Tamamlandı → stok düşür ve sipariş kontrolu
    if (newStatus === 'completed') {
      // 1. recipe_note veya BOM ile hammadde stok düş
      const { data: boms } = await supabase
        .from('bom_recipes').select('component_id, quantity_required')
        .eq('parent_id', wo.item_id);
      if (boms?.length) {
        for (const bom of boms) {
          const qty = Number(bom.quantity_required) * Number(wo.quantity || 1);
          // stock_count düşür (örn. stok.count - qty, negatife düşebilir)
          await supabase.rpc('decrement_stock', { p_item_id: bom.component_id, p_qty: qty })
            .then(async ({ error }) => {
              if (error) {
                // RPC yoksa direkt güncelle
                const { data: itm } = await supabase.from('items').select('stock_count').eq('id', bom.component_id).single();
                await supabase.from('items').update({ stock_count: (itm?.stock_count || 0) - qty }).eq('id', bom.component_id);
              }
            });
        }
      }
      // 2. Sipariş bağlı ise diğer iş emirlerini kontrol et
      if (wo.order_id) {
        const { data: siblings } = await supabase
          .from('work_orders').select('status').eq('order_id', wo.order_id);
        const allDone = siblings?.every(s => s.status === 'completed' || s.id === wo.id);
        if (allDone) {
          await supabase.from('orders').update({ status: 'completed' }).eq('id', wo.order_id);
        }
      }
    }

    onStatusChange();
    setChanging(false);
  };

  const statusFlow = {
    pending:     ['in_progress', 'cancelled'],
    in_progress: ['completed',   'cancelled'],
    completed:   [],
    cancelled:   ['pending'],
  };

  const nextStatuses = statusFlow[wo.status] || [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}25` }}>

      {/* Başlık */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
              style={{ background: s.bg, color: s.color }}>
              <Icon size={10}/> {s.label}
            </span>
            {wo.status === 'in_progress' && (
              <span className="text-[10px] text-blue-400 animate-pulse font-bold">⚡ AKTİF</span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-100 truncate">{item?.name || 'Bilinmeyen Ürün'}</p>
          <p className="text-[11px] text-slate-500">
            {fmt(wo.quantity)} {item?.unit || 'Adet'} üretim
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 font-mono">#{wo.id?.slice(0, 6).toUpperCase()}</p>
        </div>
      </div>

      {/* Bilgi satırı */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {order && (
          <div className="flex items-center gap-1.5 col-span-2 px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <User size={10} className="text-blue-400 shrink-0"/>
            <span className="text-blue-300 font-semibold truncate">
              #{order.order_number} · {order.customer_name}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-500">
          <Calendar size={10} className="shrink-0"/>
          <span>Başlangıç: {fmtD(wo.started_at)}</span>
        </div>
        {wo.completed_at && (
          <div className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 size={10} className="shrink-0"/>
            <span>Bitti: {fmtD(wo.completed_at)}</span>
          </div>
        )}
      </div>

      {wo.notes && (
        <p className="text-[11px] text-slate-500 bg-black/20 rounded-lg px-2 py-1.5 italic">
          {wo.notes}
        </p>
      )}

      {/* Aksiyon butonları */}
      <div className="flex gap-2 flex-wrap">
        {nextStatuses.map(ns => {
          const ns_ = STATUS[ns];
          return (
            <button key={ns} onClick={() => handleStatus(ns)} disabled={changing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={{ background: ns_.bg, color: ns_.color, border: `1px solid ${ns_.color}30` }}>
              {changing ? <Loader2 size={10} className="animate-spin"/> : <ns_.icon size={10}/>}
              {ns === 'in_progress' ? 'Üretime Başla'
                : ns === 'completed' ? 'Tamamlandı'
                : ns === 'cancelled' ? 'İptal Et'
                : ns === 'pending'   ? 'Beklet'
                : ns_.label}
            </button>
          );
        })}
        {wo.status === 'cancelled' && (
          <button onClick={() => onDelete(wo.id)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            Sil
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function IsEmri() {
  const { currentColor, effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [workOrders, setWorkOrders] = useState([]);
  const [items,      setItems]      = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [allBom,     setAllBom]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [woRes, itemRes, ordRes, bomRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('id, name, unit, item_type, stock_count, category').eq('is_active', true),
      supabase.from('orders').select('id, order_number, customer_name, status').order('created_at', { ascending: false }).limit(200),
      supabase.from('bom_recipes').select('id, parent_id, component_id, quantity_required, unit, notes').order('parent_id'),
    ]);
    const loadedItems = itemRes.data || [];
    setWorkOrders(woRes.data || []);
    setItems(loadedItems);
    setOrders(ordRes.data || []);
    setAllBom((bomRes.data || []).map(r => {
      const comp = loadedItems.find(i => i.id === r.component_id);
      return {
        ...r,
        component_name:     comp?.name     || '',
        component_unit:     comp?.unit     || r.unit || 'Adet',
        component_category: comp?.category || '',
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = async (id) => {
    await supabase.from('work_orders').delete().eq('id', id);
    setWorkOrders(ws => ws.filter(w => w.id !== id));
  };

  // Filtre + arama
  const filtered = workOrders.filter(wo => {
    const item = items.find(i => i.id === wo.item_id);
    const ord  = orders.find(o => o.id === wo.order_id);
    const matchSearch = !search ||
      item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      ord?.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      ord?.order_number?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || wo.status === filter;
    return matchSearch && matchFilter;
  });

  // Özet sayıları
  const counts = Object.keys(STATUS).reduce((acc, k) => {
    acc[k] = workOrders.filter(w => w.status === k).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${currentColor}20` }}>
              <Hammer size={18} style={{ color: currentColor }}/>
            </div>
            <div>
              <h1 className="text-lg font-bold">İş Emirleri</h1>
              <p className="text-xs text-slate-500">Atölye Üretim Takibi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 rounded-xl text-slate-500 hover:bg-white/05 transition-colors">
              <RefreshCw size={15}/>
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: currentColor }}>
              <Plus size={14}/> Yeni İş Emri
            </button>
          </div>
        </div>

        {/* Özet kartlar */}
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(STATUS).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(filter === k ? 'all' : k)}
              className="rounded-xl px-3 py-2 text-left transition-all"
              style={{
                background: filter === k ? v.bg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === k ? v.color + '40' : 'rgba(148,163,184,0.08)'}`,
              }}>
              <p className="text-xs font-bold" style={{ color: v.color }}>{counts[k] || 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{v.label}</p>
            </button>
          ))}
        </div>

        {/* Arama */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
          <Search size={13} className="text-slate-500 shrink-0"/>
          <input className="flex-1 bg-transparent text-sm outline-none placeholder-slate-600"
            placeholder="Ürün adı veya müşteri ara…"
            value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-slate-500"/></button>}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 size={20} className="animate-spin" style={{ color: currentColor }}/>
            <span className="text-sm text-slate-400">Yükleniyor…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <Hammer size={38} className="mx-auto mb-3 opacity-20 text-slate-400"/>
            <p className="text-sm text-slate-500">
              {filter !== 'all' ? `${STATUS[filter]?.label} iş emri yok` : 'Henüz iş emri bulunmuyor'}
            </p>
            <button onClick={() => setShowForm(true)}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: currentColor }}>
              İlk İş Emrini Oluştur
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {!loading && filtered.map(wo => (
            <WorkOrderCard key={wo.id} wo={wo} items={items} orders={orders}
              onStatusChange={loadAll} onDelete={handleDelete} currentColor={currentColor}/>
          ))}
        </AnimatePresence>
      </div>

      {/* Form modal */}
      {showForm && (
        <WorkOrderForm
          items={items} orders={orders} allBom={allBom}
          currentColor={currentColor}
          onClose={() => setShowForm(false)}
          onSaved={loadAll}/>
      )}
    </div>
  );
}
