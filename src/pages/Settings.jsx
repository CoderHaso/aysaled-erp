import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon, Save, Server, Loader2, CheckCircle2,
  AlertCircle, Plus, Trash2, Edit2, X, ChevronDown, ChevronRight, Tag, Eye
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { TEMPLATE_TYPES, DEFAULT_TEMPLATES, loadTemplates, saveTemplates, printDocument } from '../lib/printService';

const FIELD_TYPES = [
  { value: 'text',   label: 'Metin' },
  { value: 'number', label: 'Sayı'  },
  { value: 'select', label: 'Liste (Seçim)' },
];

export default function Settings() {
  const { effectiveMode, currentColor } = useTheme();
  const { profile, ROLES } = useAuth();
  const isDark = effectiveMode === 'dark';

  const [activeTab, setActiveTab] = useState(profile?.role === ROLES.ADMIN ? 'users' : 'uyumsoft');
  const [form, setForm] = useState({ username: '', password: '', isProduction: false });
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('id', 'uyumsoft').maybeSingle()
      .then(({ data }) => { if (data?.value) setForm({ username: data.value.username||'', password: data.value.password||'', isProduction: data.value.isProduction||false }); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings')
      .upsert({ id: 'uyumsoft', value: form, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) alert('Hata: ' + error.message);
    else alert('Ayarlar kaydedildi!');
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    if (!form.username || !form.password) {
      setTestResult({ success: false, message: 'Kullanıcı adı ve Şifre zorunlu.' });
      setTesting(false); return;
    }
    try {
      const res = await fetch('/api/test-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password, isProduction: form.isProduction }),
      });
      const data = await res.json();
      if (res.ok && data.success) setTestResult({ success: true, message: `Bağlantı Başarılı! Hoş geldin, ${data.user?.Name || 'Kullanıcı'}.` });
      else setTestResult({ success: false, message: data.error || 'Doğrulanamadı.' });
    } catch { setTestResult({ success: false, message: 'Backend sunucusuna ulaşılamadı.' }); }
    finally { setTesting(false); }
  };

  const c = {
    bg:     isDark ? '#0f172a' : '#f8fafc',
    card:   isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:   isDark ? '#f1f5f9' : '#0f172a',
    muted:  isDark ? '#94a3b8' : '#64748b',
    inputBg:isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc',
  };

  const TABS = [
    ...(profile?.role !== ROLES.ADMIN ? [{ id: 'uyumsoft',    label: '🔌 Uyumsoft' }] : []),
    { id: 'cat_raw',     label: '🔩 Ham. Kategoriler' },
    { id: 'cat_product', label: '⚡ Ürün Kategoriler' },
    { id: 'templates',   label: '🖨️ Şablonlar' },
    ...((profile?.role === ROLES.DEV || profile?.role === ROLES.ADMIN) ? [{ id: 'users', label: '👥 Kullanıcılar' }] : [])
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15`, color: currentColor }}>
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: c.text }}>Ayarlar</h1>
          <p className="text-sm" style={{ color: c.muted }}>Sistem ve Entegrasyon Yapılandırması</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: c.border }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all"
            style={{
              color: activeTab === t.id ? currentColor : c.muted,
              borderBottom: activeTab === t.id ? `2px solid ${currentColor}` : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* UYUMSOFT */}
      {activeTab === 'uyumsoft' && (
        <div className="rounded-3xl p-6 sm:p-8" style={{ background: c.card, border: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-3 mb-6">
            <Server size={20} style={{ color: currentColor }} />
            <h2 className="text-lg font-bold" style={{ color: c.text }}>Uyumsoft Entegrasyonu</h2>
          </div>
          <p className="text-sm mb-6 max-w-xl" style={{ color: c.muted, lineHeight: 1.6 }}>
            A-ERP'yi Uyumsoft E-Fatura sistemine bağlamak için API bilgilerinizi girin.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mb-6">
            <div>
              <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: c.muted }}>API Kullanıcı Adı</label>
              <input type="text" className="input-field" placeholder="Örn: aysaled_api"
                value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: c.muted }}>API Şifresi</label>
              <input type="password" className="input-field" placeholder="••••••••"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <input type="checkbox" id="isProduction" checked={form.isProduction}
              onChange={e => setForm(p => ({ ...p, isProduction: e.target.checked }))}
              style={{ accentColor: currentColor }} />
            <label htmlFor="isProduction" className="text-sm font-medium" style={{ color: c.text }}>Canlı Ortam (Production)</label>
          </div>
          {testResult && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 rounded-xl flex items-center gap-3"
              style={{ background: testResult.success ? '#10b98115' : '#ef444415', color: testResult.success ? '#10b981' : '#ef4444' }}>
              {testResult.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-semibold">{testResult.message}</p>
            </motion.div>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-6 border-t" style={{ borderColor: c.border }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ background: currentColor }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Kaydet
            </button>
            <button onClick={handleTest} disabled={testing} className="btn-ghost">
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Server size={16} />}
              {testing ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
            </button>
          </div>
        </div>
      )}

      {/* KATEGORİ YÖNETİMİ */}
      {(activeTab === 'cat_raw' || activeTab === 'cat_product') && (
        <CategoryManager
          scope={activeTab === 'cat_raw' ? 'rawmaterial' : 'product'}
          c={c} currentColor={currentColor} isDark={isDark}
        />
      )}

      {/* ŞABLON YÖNETİMİ */}
      {activeTab === 'templates' && (
        <TemplateManager c={c} currentColor={currentColor} isDark={isDark} />
      )}

      {/* KULLANICI YÖNETİMİ */}
      {activeTab === 'users' && (
        <UsersManager c={c} currentColor={currentColor} isDark={isDark} profile={profile} ROLES={ROLES} />
      )}
    </motion.div>
  );
}

// ═══════════════ KULLANICI YÖNETİCİSİ ═══════════════
function UsersManager({ c, currentColor, isDark, profile, ROLES }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const ALL_TABS = [
    { id: '/', label: 'Genel Bakış' },
    { id: '/stock', label: 'Stok Merkezi' },
    { id: '/suppliers', label: 'Tedarikçiler' },
    { id: '/contacts', label: 'Cari Takip' },
    { id: '/ledger', label: 'Hesap Defteri' },
    { id: '/is-emri', label: 'İş Emirleri' },
    { id: '/kasa', label: 'Kasa' },
    { id: '/incoming-invoices', label: 'Giden Fat.' },
    { id: '/outgoing-invoices', label: 'Gelen Fat.' },
    { id: '/sales', label: 'Satış' },
    { id: '/quotes', label: 'Teklifler' },
    { id: '/katalog', label: 'Katalog Merkezi' },
    { id: '/media', label: 'Medya' },
    { id: '/reports', label: 'Raporlar' },
    { id: '/settings', label: 'Ayarlar' }
  ];

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('email');
    setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const updateUser = async (userId, patch) => {
    await supabase.from('profiles').update(patch).eq('id', userId);
    loadUsers();
  };

  const toggleTab = (userId, currentTabs, tabId) => {
    let newTabs = currentTabs || [];
    if (newTabs.includes(tabId)) {
       newTabs = newTabs.filter(t => t !== tabId);
    } else {
       newTabs = [...newTabs, tabId];
    }
    updateUser(userId, { allowed_tabs: newTabs });
  };

  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: c.text }}>Sistem Kullanıcıları</h2>
          <p className="text-sm mt-0.5" style={{ color: c.muted }}>Tüm kullanıcıların rollerini ve erişim izinlerini ayarlayın.</p>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: currentColor }} /></div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="rounded-xl overflow-hidden p-4 space-y-4" style={{ border: `1px solid ${c.border}` }}>
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div>
                   <p className="font-semibold text-sm" style={{ color: c.text }}>{u.email}</p>
                   {u.id === profile.id && <p className="text-[10px] font-bold text-emerald-500">Bu Sensin</p>}
                </div>
                {profile.role === ROLES.DEV || (profile.role === ROLES.ADMIN && u.role !== ROLES.DEV) ? (
                  <select value={u.role || ROLES.ATOLYE} onChange={e => updateUser(u.id, { role: e.target.value })}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg outline-none" style={{ background: c.inputBg, border: `1px solid ${c.border}`, color: c.text }}>
                    <option value={ROLES.DEV} disabled={profile.role !== ROLES.DEV}>Geliştirici (Dev)</option>
                    <option value={ROLES.ADMIN}>Yönetici (Admin)</option>
                    <option value={ROLES.ATOLYE}>Atölye (Sadece İş Emri)</option>
                    <option value={ROLES.OZEL}>Özel Rol (Seçili Sekmeler)</option>
                  </select>
                ) : (
                  <span className="px-3 py-1.5 text-xs font-bold rounded-lg" style={{ background: c.inputBg, color: c.muted }}>{u.role}</span>
                )}
              </div>
              
              {u.role === ROLES.OZEL && (profile.role === ROLES.DEV || profile.role === ROLES.ADMIN) && (
                <div className="pt-3 border-t grid grid-cols-2 sm:grid-cols-3 gap-2" style={{ borderColor: c.border }}>
                   {ALL_TABS.map(tab => {
                     const isChecked = (u.allowed_tabs || []).includes(tab.id) || (u.allowed_tabs || []).includes('*');
                     return (
                       <label key={tab.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg transition-colors"
                         style={{ background: isChecked ? `${currentColor}15` : 'transparent' }}>
                         <input type="checkbox" checked={isChecked} onChange={() => toggleTab(u.id, u.allowed_tabs, tab.id)}
                           className="rounded" style={{ accentColor: currentColor }} />
                         <span className="text-[10px] font-semibold" style={{ color: isChecked ? c.text : c.muted }}>{tab.label}</span>
                       </label>
                     );
                   })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════ KATEGORİ YÖNETİCİSİ ═══════════════
function CategoryManager({ scope, c, currentColor, isDark }) {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [editing,    setEditing]    = useState(null); // category id or 'new'
  const [newName,    setNewName]    = useState('');
  const [draftFields,setDraftFields]= useState([]); // fields of the category being edited

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('item_categories').select('*').eq('item_scope', scope).order('name');
    setCategories(data || []);
    setLoading(false);
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (cat) => {
    setEditing(cat.id);
    setNewName(cat.name);
    setDraftFields(cat.fields ? JSON.parse(JSON.stringify(cat.fields)) : []);
  };

  const startNew = () => {
    setEditing('new');
    setNewName('');
    setDraftFields([]);
  };

  const cancelEdit = () => { setEditing(null); setNewName(''); setDraftFields([]); };

  const saveCategory = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    if (editing === 'new') {
      await supabase.from('item_categories').insert({ name: newName.trim(), item_scope: scope, fields: draftFields });
    } else {
      await supabase.from('item_categories').update({ name: newName.trim(), fields: draftFields, updated_at: new Date().toISOString() }).eq('id', editing);
    }
    setSaving(false);
    cancelEdit();
    load();
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Bu kategoriyi silmek istiyor musunuz? Bu kategorideki ürünlerin kategorisi kaldırılır.')) return;
    await supabase.from('item_categories').delete().eq('id', id);
    load();
  };

  // ── Draft field helpers ──────────────────────────────────────────────────
  const addField = () => setDraftFields(f => [...f, { name: '', type: 'text', options: [] }]);
  const setFieldProp = (i, key, val) => {
    setDraftFields(f => {
      const copy = [...f];
      copy[i] = { ...copy[i], [key]: val };
      return copy;
    });
  };
  const removeField = (i) => setDraftFields(f => f.filter((_, idx) => idx !== i));
  const setOptions = (i, raw) => {
    const opts = raw.split(',').map(s => s.trim()).filter(Boolean);
    setFieldProp(i, 'options', opts);
  };

  const scopeLabel = scope === 'rawmaterial' ? 'Hammadde' : 'Ürün';

  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: c.text }}>{scopeLabel} Kategorileri</h2>
          <p className="text-sm mt-0.5" style={{ color: c.muted }}>
            Kategoriye özel teknik alanlar tanımlayın. Stok eklerken kategori seçilince bu alanlar çıkar.
          </p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: currentColor }}>
          <Plus size={14} /> Yeni Kategori
        </button>
      </div>

      {/* Yeni / Düzenleme Formu */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="rounded-2xl p-5 space-y-4" style={{ border: `1.5px solid ${currentColor}40`, background: `${currentColor}06` }}>
              <p className="text-sm font-bold" style={{ color: currentColor }}>
                {editing === 'new' ? '+ Yeni Kategori' : 'Kategoriyi Düzenle'}
              </p>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: c.muted }}>Kategori Adı</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl outline-none border text-sm"
                  style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                  placeholder={`Örn: LED, Profil, ${scopeLabel === 'Ürün' ? 'Lineer Aydınlatma' : 'Driver'}`} />
              </div>

              {/* Alanlar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.muted }}>
                    Teknik Alanlar
                  </label>
                  <button onClick={addField}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: `${currentColor}15`, color: currentColor }}>
                    <Plus size={11} className="inline mr-1" />Alan Ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {draftFields.map((field, i) => (
                    <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9', border: `1px solid ${c.border}` }}>
                      <div className="grid grid-cols-3 gap-2">
                        <input value={field.name} onChange={e => setFieldProp(i, 'name', e.target.value)}
                          className="col-span-2 px-3 py-2 text-sm rounded-lg outline-none border"
                          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                          placeholder="Alan adı (Örn: Güç)" />
                        <select value={field.type} onChange={e => setFieldProp(i, 'type', e.target.value)}
                          className="px-2 py-2 text-sm rounded-lg outline-none border"
                          style={{ background: c.inputBg, borderColor: c.border, color: c.text }}>
                          {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                        </select>
                      </div>
                      {field.type === 'select' && (
                        <div>
                          <p className="text-[10px] mb-1" style={{ color: c.muted }}>Seçenekler (virgülle ayır)</p>
                          <input value={(field.options || []).join(', ')}
                            onChange={e => setOptions(i, e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg outline-none border"
                            style={{ background: c.inputBg, borderColor: c.border, color: c.text }}
                            placeholder="Örn: 3W, 5W, 10W, 20W" />
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button onClick={() => removeField(i)}
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          <Trash2 size={11} className="inline mr-1" />Sil
                        </button>
                      </div>
                    </div>
                  ))}
                  {draftFields.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: c.muted }}>
                      Bu kategori için teknik alan tanımlanmamış. Alan Ekle ile ekleyin.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={saveCategory} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: saving ? '#64748b' : currentColor }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button onClick={cancelEdit}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: c.border, color: c.muted }}>
                  İptal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kategori listesi */}
      {loading ? (
        <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: currentColor }} /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ border: `1.5px dashed ${c.border}` }}>
          <p className="text-sm font-semibold" style={{ color: c.muted }}>Henüz kategori yok</p>
          <button onClick={startNew} className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: currentColor }}>
            + İlk Kategoriyi Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <CategoryRow key={cat.id} cat={cat}
              onEdit={() => startEdit(cat)}
              onDelete={() => deleteCategory(cat.id)}
              c={c} currentColor={currentColor} isDark={isDark}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat, onEdit, onDelete, c, currentColor, isDark }) {
  const [open, setOpen] = useState(false);
  const fields = cat.fields || [];
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        style={{ background: open ? `${currentColor}06` : 'transparent' }}
        onClick={() => setOpen(o => !o)}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: currentColor }}>
          {cat.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: c.text }}>{cat.name}</p>
          <p className="text-[11px]" style={{ color: c.muted }}>{fields.length} teknik alan</p>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: currentColor }}
            onMouseEnter={e => e.currentTarget.style.background = `${currentColor}15`}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Edit2 size={13} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Trash2 size={13} />
          </button>
          {open ? <ChevronDown size={14} style={{ color: c.muted }} /> : <ChevronRight size={14} style={{ color: c.muted }} />}
        </div>
      </div>
      {open && fields.length > 0 && (
        <div className="px-4 py-3 border-t flex flex-wrap gap-2" style={{ borderColor: c.border }}>
          {fields.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: c.text }}>
              <Tag size={10} style={{ color: currentColor }} />
              {f.name}
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: `${currentColor}20`, color: currentColor }}>
                {f.type === 'select' ? `Liste (${(f.options||[]).length})` : f.type === 'number' ? 'Sayı' : 'Metin'}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════ ŞABLON YÖNETİCİSİ ═══════════════
function TemplateManager({ c, currentColor, isDark }) {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeType, setActiveType] = useState(TEMPLATE_TYPES[0].id);
  const [editorValue, setEditorValue] = useState('');
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    setLoading(true);
    loadTemplates().then(t => { setTemplates(t); setLoading(false); });
  }, []);

  useEffect(() => {
    setEditorValue(templates[activeType] || DEFAULT_TEMPLATES[activeType] || '');
    setSaved(false);
  }, [activeType, templates]);

  const handleSave = async () => {
    setSaving(true);
    const updated = { ...templates, [activeType]: editorValue };
    await saveTemplates(updated);
    setTemplates(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!window.confirm('Bu şablonu varsayılana sıfırlamak istediğinize emin misiniz?')) return;
    setEditorValue(DEFAULT_TEMPLATES[activeType] || '');
  };

  const handlePreview = () => {
    // Örnek veri ile önizleme
    const sampleData = {
      order_number: 'AYS-TEST-001', customer_name: 'Örnek Müşteri A.Ş.', customer_vkntckn: '1234567890',
      status: 'Tamamlandı', currency: 'TRY', created_at: new Date().toISOString(),
      subtotal: 5000, tax_total: 900, grand_total: 5900, notes: 'Örnek sipariş notu.',
      items: [
        { item_name: 'LED Panel 60x60', quantity: 10, unit: 'Adet', unit_price: 350, tax_rate: 20, line_total: 3500 },
        { item_name: 'Driver 40W', quantity: 10, unit: 'Adet', unit_price: 150, tax_rate: 20, line_total: 1500 },
      ],
      // Reçete
      product_name: 'LED Panel 60x60', recipe_name: 'Standart', description: 'Standart üretim reçetesi',
      total_cost: 180,
      ingredients: [
        { item_name: 'LED Chip 0.5W', quantity: 120, unit: 'Adet', unit_cost: 0.50, total_cost: 60 },
        { item_name: 'PCB Board', quantity: 1, unit: 'Adet', unit_cost: 45, total_cost: 45 },
        { item_name: 'Alüminyum Profil', quantity: 2.4, unit: 'mt', unit_cost: 25, total_cost: 60 },
        { item_name: 'Driver 40W', quantity: 1, unit: 'Adet', unit_cost: 15, total_cost: 15 },
      ],
      tags: 'standart, 60x60, panel',
      // Çek
      cheque_no: 'ÇK-2026-001', direction_label: 'Alınan', amount: 25000, bank_name: 'Garanti Bankası',
      issue_date: new Date().toISOString(), due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      from_name: 'ABC İnşaat Ltd.', to_name: 'AYSALED', status_label: 'Aktif', note: 'Proje ödemesi',
      // İş Emri
      wo_number: 'WO-2026-042', quantity: 50, unit: 'Adet', per_unit: 120,
      production_note: 'Acil üretim - teslimat 3 gün içinde',
      // Hesap Ekstresi
      entity_name: 'Örnek Müşteri', vkntckn: '1234567890',
      movements: [
        { date: new Date().toISOString(), description: 'Fatura - AYS001', debit: 5900, credit: 0, balance: 5900 },
        { date: new Date().toISOString(), description: 'Tahsilat', debit: 0, credit: 3000, balance: 2900 },
      ],
      total_debit: 5900, total_credit: 3000, net_balance: 2900,
      // Kasa
      receipt_type: 'TAHSİLAT MAKBUZU', date: new Date().toISOString(),
      category: 'Satış Tahsilatı', entity_name: 'Örnek Müşteri', description: 'Sipariş ödemesi',
      // Rapor
      month_name: 'Nisan', year: 2026, total_sales: 125000, net_profit: 35000, margin: 28,
      order_count: 45, invoiced_count: 30, invoiced_total: 95000, non_invoiced_count: 15, non_invoiced_total: 30000,
      // Teklif
      quote_number: 'TKF-2026-015', valid_until: new Date(Date.now() + 15 * 86400000).toISOString(),
      project_name: 'Ofis Aydınlatma Projesi',
    };
    printDocument(activeType, sampleData, `Önizleme - ${TEMPLATE_TYPES.find(t => t.id === activeType)?.label}`);
  };

  const activeInfo = TEMPLATE_TYPES.find(t => t.id === activeType);

  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
      <div>
        <h2 className="text-lg font-bold" style={{ color: c.text }}>Yazdırma Şablonları</h2>
        <p className="text-sm mt-0.5" style={{ color: c.muted }}>
          Her belge türü için HTML şablonlarını düzenleyin. <code className="text-xs px-1 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>{'{{değişken}}'}</code> söz dizimi ile veri bağlama yapılır.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: currentColor }} /></div>
      ) : (
        <>
          {/* Şablon türü seçimi */}
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_TYPES.map(t => (
              <button key={t.id} onClick={() => setActiveType(t.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border"
                style={{
                  background: activeType === t.id ? currentColor + '18' : 'transparent',
                  borderColor: activeType === t.id ? currentColor + '40' : c.border,
                  color: activeType === t.id ? currentColor : c.muted,
                }}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Aktif şablon bilgisi */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold" style={{ color: c.text }}>{activeInfo?.icon} {activeInfo?.label}</p>
              <p className="text-xs" style={{ color: c.muted }}>{activeInfo?.desc}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{ borderColor: c.border, color: '#ef4444' }}>
                Varsayılana Sıfırla
              </button>
              <button onClick={handlePreview}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{ borderColor: c.border, color: currentColor }}>
                <Eye size={12} className="inline mr-1" />Önizle
              </button>
            </div>
          </div>

          {/* Editor */}
          <textarea
            value={editorValue}
            onChange={e => { setEditorValue(e.target.value); setSaved(false); }}
            className="w-full rounded-xl border outline-none font-mono text-xs leading-relaxed p-4 resize-y"
            style={{
              background: c.inputBg,
              borderColor: c.border,
              color: c.text,
              minHeight: 350,
              maxHeight: 600,
            }}
            spellCheck={false}
          />

          {/* Değişken referansı */}
          <details className="rounded-xl border p-3" style={{ borderColor: c.border }}>
            <summary className="text-xs font-bold cursor-pointer" style={{ color: c.muted }}>
              📖 Kullanılabilir Değişkenler & Söz Dizimi
            </summary>
            <div className="mt-3 text-xs space-y-2" style={{ color: c.muted }}>
              <p><code>{'{{değişken}}'}</code> — Veri bağlama</p>
              <p><code>{'{{fmt:değişken}}'}</code> — Sayı formatı (1.234,56)</p>
              <p><code>{'{{date:değişken}}'}</code> — Tarih formatı (19.04.2026)</p>
              <p><code>{'{{money:değişken}}'}</code> — Para formatı (₺1.234,56)</p>
              <p><code>{'{{#each items}} ... {{/each}}'}</code> — Liste döngüsü</p>
              <p><code>{'{{#if var}} ... {{/if}}'}</code> — Koşullu gösterim</p>
              <p><code>{'{{@index}}'}</code> — Döngü sıra numarası</p>
              <div className="border-t pt-2 mt-2" style={{ borderColor: c.border }}>
                <p className="font-bold" style={{ color: c.text }}>Otomatik değişkenler:</p>
                <p><code>{'{{_today}}'}</code> — Bugünün tarihi · <code>{'{{_now}}'}</code> — Şu anki zaman · <code>{'{{_company}}'}</code> — Firma adı</p>
              </div>
            </div>
          </details>

          {/* Kaydet */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: saving ? '#64748b' : currentColor }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Kaydediliyor...' : 'Şablonu Kaydet'}
            </button>
            {saved && (
              <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 size={14} /> Kaydedildi!
              </motion.span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
