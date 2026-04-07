import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Check, HelpCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function CustomDialog({ 
  open, 
  onClose, 
  onConfirm, 
  title = 'Onay', 
  message = '', 
  type = 'confirm', // 'confirm' | 'alert' | 'danger'
  confirmText = 'Tamam',
  cancelText = 'İptal',
  loading = false
}) {
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  if (!open) return null;

  const iconMap = {
    confirm: <HelpCircle className="text-blue-400" size={28} />,
    alert:   <AlertCircle className="text-amber-400" size={28} />,
    danger:  <AlertCircle className="text-red-400" size={28} />,
  };

  const btnColor = {
    confirm: '#3b82f6',
    alert:   '#f59e0b',
    danger:  '#ef4444',
  }[type];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={loading ? null : onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Dialog Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-hidden shadow-black/50"
          style={{
            background: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}`,
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 p-3 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9' }}>
              {iconMap[type]}
            </div>
            
            <h3 className="text-lg font-bold mb-2" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{title}</h3>
            <p className="text-sm leading-relaxed mb-6 whitespace-pre-wrap" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              {message}
            </p>

            <div className="flex w-full gap-3">
              {type !== 'alert' && (
                <button 
                  disabled={loading}
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
                  style={{ color: isDark ? '#cbd5e1' : '#64748b', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
                >
                  {cancelText}
                </button>
              )}
              <button 
                disabled={loading}
                onClick={onConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white shadow-xl transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: btnColor }}
              >
                {loading ? (
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  type === 'alert' ? <Check size={16} /> : null
                )}
                {confirmText}
              </button>
            </div>
          </div>

          {!loading && (
             <button onClick={onClose} className="absolute top-4 right-4 transition-colors" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
               <X size={18} />
             </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
