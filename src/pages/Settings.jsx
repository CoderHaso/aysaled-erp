import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, Server, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

export default function Settings() {
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [form, setForm] = useState({ username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase.from('app_settings').select('value').eq('id', 'uyumsoft').single();
      if (!error && data?.value) {
        setForm({ username: data.value.username || '', password: data.value.password || '' });
      }
    }
    loadSettings();
  }, []);

  const handleChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 'uyumsoft', value: form, updated_at: new Date().toISOString() });
      
    setSaving(false);
    if (error) {
      alert('Ayarlar kaydedilirken hata oluştu: ' + error.message);
    } else {
      alert('Ayarlar sunucuya güvenle kaydedildi!');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    if (!form.username || !form.password) {
      setTestResult({ success: false, message: 'Kullanıcı adı ve Şifre boş bırakılamaz.' });
      setTesting(false);
      return;
    }

    try {
      const res = await fetch('/api/test-auth', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password }) 
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({ success: true, message: `Bağlantı Başarılı! Hoş geldin, ${data.user?.Name || 'Kullanıcı'}.` });
      } else {
        setTestResult({ success: false, message: data.error || data.detail || 'Doğrulanamadı.' });
      }
    } catch (err) {
      console.error('Test Auth Error:', err);
      setTestResult({ success: false, message: 'Backend sunucusuna ulaşılamadı. (Vercel servisi kapalı veya local proxy çalışmıyor)' });
    } finally {
      setTesting(false);
    }
  };

  const c = {
    bg:       isDark ? '#0f172a' : '#f8fafc',
    card:     isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border:   isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#64748b',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: `${currentColor}15`, color: currentColor }}>
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: c.text }}>Ayarlar</h1>
          <p className="text-sm" style={{ color: c.muted }}>Sistem ve Entegrasyon Yapılandırması</p>
        </div>
      </div>

      {/* Uyumsoft Card */}
      <div className="rounded-3xl p-6 sm:p-8" style={{ background: c.card, border: `1px solid ${c.border}` }}>
        <div className="flex items-center gap-3 mb-6">
          <Server size={20} style={{ color: currentColor }} />
          <h2 className="text-lg font-bold" style={{ color: c.text }}>Uyumsoft Entegrasyonu</h2>
        </div>
        
        <p className="text-sm mb-6 max-w-xl" style={{ color: c.muted, lineHeight: 1.6 }}>
          A-ERP'yi Uyumsoft E-Fatura/E-İrsaliye sistemine bağlamak için API bilgilerinizi girin. Tüm faturalarınız ve irsaliyeleriniz Uyumsoft ile otomatik sekronize edilecektir.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mb-6">
          <div>
            <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: c.muted }}>API Kullanıcı Adı</label>
            <input type="text" className="input-field" placeholder="Örn: aysaled_api"
              value={form.username} onChange={e => handleChange('username', e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: c.muted }}>API Şifresi</label>
            <input type="password" className="input-field" placeholder="••••••••"
              value={form.password} onChange={e => handleChange('password', e.target.value)} />
          </div>
        </div>

        {testResult && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl flex items-center gap-3"
            style={{ background: testResult.success ? '#10b98115' : '#ef444415', color: testResult.success ? '#10b981' : '#ef4444' }}>
            {testResult.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-semibold">{testResult.message}</p>
          </motion.div>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-8 pt-6 border-t" style={{ borderColor: c.border }}>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary" style={{ background: currentColor }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Ayarları Kaydet
          </button>
          <button onClick={handleTest} disabled={testing}
            className="btn-ghost">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Server size={16} />}
            {testing ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
