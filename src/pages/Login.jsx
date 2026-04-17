import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const c = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? 'rgba(30,41,59,0.7)' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.1)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, pass);
      } else {
        await register(email, pass);
        // Otomatik giris olabilir ama hata olmazsa basarili mesaji!
        // Supabase bazen mail onayi ister, o sebeple register olan uyeyi uyarabiliriz:
      }
    } catch (err) {
      setError(err.message || 'Bir hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: c.bg }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-3xl shadow-2xl relative overflow-hidden"
        style={{ background: c.card, border: `1px solid ${c.border}`, backdropFilter: 'blur(20px)' }}>
        
        {/* Decorative background shapes */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: currentColor, transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl opacity-10" style={{ background: currentColor, transform: 'translate(-30%, 30%)' }} />

        <div className="relative z-10">
          <div className="text-center mb-10">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" 
               style={{ background: `${currentColor}15`, color: currentColor }}>
               <Lock size={32} />
             </div>
             <h1 className="text-3xl font-black tracking-tight" style={{ color: c.text }}>Aysaled ERP</h1>
             <p className="text-sm font-medium mt-2" style={{ color: c.muted }}>
               {isLogin ? 'Hoş geldiniz, devam etmek için giriş yapın' : 'Yeni bir hesap oluşturun'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="overflow-hidden">
                  <div className="px-4 py-3 rounded-xl flex items-start gap-2 text-sm font-bold bg-red-500/10 text-red-500 border border-red-500/20 mb-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 ml-1 block" style={{ color: c.muted }}>Email Adresi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none" style={{ color: c.muted }}>
                  <Mail size={16} />
                </div>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f1f5f9', border: `1px solid ${c.border}`, color: c.text }}
                  placeholder="isim@sirket.com" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 ml-1 block" style={{ color: c.muted }}>Şifre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none" style={{ color: c.muted }}>
                  <Lock size={16} />
                </div>
                <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f1f5f9', border: `1px solid ${c.border}`, color: c.text }}
                  placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="mt-4 w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 shadow-lg disabled:opacity-70 disabled:hover:scale-100"
              style={{ background: currentColor }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)}
              {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-medium">
            <span style={{ color: c.muted }}>
              {isLogin ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}
            </span>
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="ml-2 font-bold hover:underline transition-all"
              style={{ color: currentColor }}>
              {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
