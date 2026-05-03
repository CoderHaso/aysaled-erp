/**
 * AIChatDrawer.jsx
 * Sağdan açılan AI Asistan drawer + Floating buton
 * Her sayfada görünür, tam ekran moda geçebilir
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAIChat } from '../contexts/AIChatContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  X, Send, Maximize2, Minimize2, MessageSquare, Plus,
  Loader2, Bot, User, Wrench, ChevronDown, ChevronRight,
  Trash2, History, ToggleLeft, ToggleRight, Sparkles,
  AlertCircle, Copy, Check, ArrowLeft,
} from 'lucide-react';

// ── Markdown-light renderer ──────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  // Bold
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(139,92,246,0.15);padding:1px 5px;border-radius:4px;font-size:0.85em">$1</code>');
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;margin:8px 0 4px">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:10px 0 4px">$1</h3>');
  // Tables — simple markdown table to HTML
  const tableRegex = /(\|.+\|\n)+/g;
  html = html.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return match;
    // Check if second row is separator
    const isSep = rows[1] && /^\|[\s\-:|]+\|$/.test(rows[1].trim());
    const dataRows = isSep ? [rows[0], ...rows.slice(2)] : rows;
    let table = '<div style="overflow-x:auto;margin:8px 0"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    dataRows.forEach((row, i) => {
      const cells = row.split('|').filter(c => c.trim() !== '');
      const tag = i === 0 ? 'th' : 'td';
      const bg = i === 0 ? 'rgba(139,92,246,0.1)' : (i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent');
      table += `<tr style="background:${bg}">`;
      cells.forEach(c => {
        table += `<${tag} style="padding:4px 8px;border:1px solid rgba(148,163,184,0.15);text-align:left;white-space:nowrap">${c.trim()}</${tag}>`;
      });
      table += '</tr>';
    });
    table += '</table></div>';
    return table;
  });
  // List items
  html = html.replace(/^- (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="opacity:0.5">•</span><span>$1</span></div>');
  html = html.replace(/^\d+\. (.+)$/gm, (_, content, offset, str) => {
    return `<div style="display:flex;gap:6px;margin:2px 0"><span style="opacity:0.5">•</span><span>${content}</span></div>`;
  });
  // Newlines
  html = html.replace(/\n/g, '<br/>');
  return html;
}

// ── Tool badge ───────────────────────────────────────────────────────────────
function ToolBadge({ tool, c, currentColor }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
        style={{ background: `${currentColor}12`, color: currentColor, border: `1px solid ${currentColor}20` }}>
        <Wrench size={10} />
        {tool.name.replace('query_', '').replace('get_', '')}
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
      </button>
      {open && (
        <pre className="mt-1 p-2 rounded-lg text-[9px] leading-relaxed overflow-x-auto"
          style={{ background: 'rgba(0,0,0,0.2)', color: c.muted, maxHeight: 120 }}>
          {JSON.stringify(tool.args, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, c, currentColor, isDark }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isError = msg.isError;

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: 16 }}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: isError ? 'rgba(239,68,68,0.15)' : `${currentColor}15` }}>
          {isError ? <AlertCircle size={14} style={{ color: '#ef4444' }} /> : <Bot size={14} style={{ color: currentColor }} />}
        </div>
      )}

      {/* Content */}
      <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
        {/* Tools used */}
        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {msg.toolsUsed.map((t, i) => (
              <ToolBadge key={i} tool={t} c={c} currentColor={currentColor} />
            ))}
          </div>
        )}

        {/* Bubble */}
        <div className="relative group rounded-2xl px-3.5 py-2.5"
          style={{
            background: isUser
              ? currentColor
              : isError
                ? 'rgba(239,68,68,0.08)'
                : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            color: isUser ? '#fff' : isError ? '#ef4444' : c.text,
            borderBottomRightRadius: isUser ? 6 : 18,
            borderBottomLeftRadius: isUser ? 18 : 6,
          }}>
          <div className="text-[12.5px] leading-[1.65]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

          {/* Copy button */}
          {!isUser && !isError && msg.content && (
            <button onClick={handleCopy}
              className="absolute -bottom-5 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
              style={{ background: c.card, color: c.muted, fontSize: 9 }}>
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-[9px]" style={{ color: c.muted }}>
            {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.model && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: `${currentColor}10`, color: currentColor }}>
              {msg.model.split('/').pop().split('-').slice(0, 2).join('-')}
            </span>
          )}
          {msg.fallback && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
              fallback
            </span>
          )}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 order-2"
          style={{ background: `${currentColor}25` }}>
          <User size={14} style={{ color: currentColor }} />
        </div>
      )}
    </div>
  );
}

// ── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ c, currentColor, isDark, onClose }) {
  const { conversations, loadingHistory, loadConversations, loadConversation, deleteConversation, startNewConversation } = useAIChat();

  useEffect(() => { loadConversations(); }, [loadConversations]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col" style={{ background: isDark ? '#0b1729' : '#f8fafc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: c.border }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: c.muted }}>
            <ArrowLeft size={16} />
          </button>
          <h3 className="text-sm font-bold" style={{ color: c.text }}>Konuşma Geçmişi</h3>
        </div>
        <button onClick={() => { startNewConversation(); onClose(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white"
          style={{ background: currentColor }}>
          <Plus size={11} /> Yeni
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loadingHistory && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: currentColor }} />
          </div>
        )}
        {!loadingHistory && conversations.length === 0 && (
          <p className="text-center text-xs py-8" style={{ color: c.muted }}>Henüz konuşma yok</p>
        )}
        {conversations.map(conv => (
          <div key={conv.id}
            className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all group"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${c.border}` }}
            onClick={() => { loadConversation(conv.id); onClose(); }}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: c.text }}>
                {conv.title || 'Konuşma'}
              </p>
              <p className="text-[10px]" style={{ color: c.muted }}>
                {new Date(conv.updated_at || conv.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: '#ef4444' }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: '📦 Kritik stoklar', text: 'Kritik stok seviyesinin altında olan kalemleri göster' },
  { label: '📊 Satış özeti', text: 'Bu ayın satış faturalarının özetini ver' },
  { label: '🧪 Reçete maliyet', text: 'En pahalı reçeteleri listele' },
  { label: '👥 Müşteri listesi', text: 'Son 10 müşteriyi listele' },
  { label: '📈 Genel durum', text: 'Sistemin genel durumunu özetle' },
];

// ── Main Drawer Component ────────────────────────────────────────────────────
export default function AIChatDrawer() {
  const {
    isDrawerOpen, isFullscreen,
    closeDrawer, toggleFullscreen,
    usePageContext, setUsePageContext,
    messages, isLoading, error,
    sendMessage, cancelRequest, startNewConversation,
    canUseAI,
  } = useAIChat();

  const { effectiveMode, currentColor } = useTheme();
  const isDark = effectiveMode === 'dark';

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const c = {
    bg: isDark ? '#0b1729' : '#f8fafc',
    card: isDark ? '#111d33' : '#fff',
    border: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? 'rgba(30,41,59,0.8)' : '#f1f5f9',
  };

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isDrawerOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isDrawerOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isDrawerOpen || !canUseAI) return null;

  const drawerWidth = isFullscreen ? '100vw' : '440px';
  const drawerMaxW = isFullscreen ? '100vw' : '440px';

  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end" style={{ pointerEvents: 'none' }}>
      {/* Backdrop */}
      {!isFullscreen && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          style={{ pointerEvents: 'auto' }} onClick={closeDrawer} />
      )}

      {/* Drawer panel */}
      <div
        className="relative h-full flex flex-col overflow-hidden shadow-2xl"
        style={{
          width: drawerWidth,
          maxWidth: drawerMaxW,
          background: c.bg,
          borderLeft: isFullscreen ? 'none' : `1px solid ${c.border}`,
          pointerEvents: 'auto',
          animation: 'slideInRight 0.25s ease-out',
        }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)', borderBottom: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${currentColor}20` }}>
              <Sparkles size={16} style={{ color: currentColor }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: c.text }}>A-ERP Asistan</h2>
              <p className="text-[10px]" style={{ color: c.muted }}>
                {isLoading ? 'Düşünüyor...' : 'Yapay Zeka Destekli'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Page context toggle */}
            <button onClick={() => setUsePageContext(p => !p)}
              className="p-1.5 rounded-lg transition-colors" title={usePageContext ? 'Sayfa bağlamı aktif' : 'Sayfa bağlamı kapalı'}
              style={{ color: usePageContext ? currentColor : c.muted }}>
              {usePageContext ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>
            {/* History */}
            <button onClick={() => setShowHistory(true)}
              className="p-1.5 rounded-lg" style={{ color: c.muted }} title="Geçmiş">
              <History size={16} />
            </button>
            {/* New chat */}
            <button onClick={startNewConversation}
              className="p-1.5 rounded-lg" style={{ color: c.muted }} title="Yeni konuşma">
              <Plus size={16} />
            </button>
            {/* Fullscreen toggle */}
            <button onClick={toggleFullscreen}
              className="p-1.5 rounded-lg" style={{ color: c.muted }} title={isFullscreen ? 'Küçült' : 'Tam ekran'}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {/* Close */}
            <button onClick={closeDrawer}
              className="p-1.5 rounded-lg" style={{ color: c.muted }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── History overlay ── */}
        {showHistory && (
          <HistoryPanel c={c} currentColor={currentColor} isDark={isDark} onClose={() => setShowHistory(false)} />
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollBehavior: 'smooth' }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `${currentColor}12` }}>
                <Sparkles size={32} style={{ color: currentColor }} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold mb-1" style={{ color: c.text }}>Merhaba! 👋</h3>
                <p className="text-xs mb-6" style={{ color: c.muted, maxWidth: 280 }}>
                  Size ERP verileriniz hakkında yardımcı olabilirim. Stok, fatura, müşteri, reçete — ne isterseniz sorun.
                </p>
              </div>
              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2 justify-center max-w-[360px]">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i}
                    onClick={() => { setInput(s.text); setTimeout(() => inputRef.current?.focus(), 100); }}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:scale-[1.02]"
                    style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${c.border}`, color: c.text }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} c={c} currentColor={currentColor} isDark={isDark} />
              ))}
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{ background: `${currentColor}15` }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: currentColor }} />
                  </div>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: currentColor, animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: currentColor, animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: currentColor, animationDelay: '300ms' }} />
                  </div>
                  <button onClick={cancelRequest} className="ml-2 text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                    İptal
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ── Input bar ── */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}`, background: c.card }}>
          {usePageContext && (
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${currentColor}10`, color: currentColor }}>
                📍 Sayfa bağlamı aktif
              </span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bir soru sorun..."
              rows={1}
              className="flex-1 resize-none px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all"
              style={{
                background: c.inputBg,
                border: `1px solid ${c.border}`,
                color: c.text,
                maxHeight: 120,
                minHeight: 38,
              }}
              onInput={e => {
                e.target.style.height = '38px';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button onClick={handleSend} disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl transition-all flex-shrink-0"
              style={{
                background: input.trim() ? currentColor : 'transparent',
                color: input.trim() ? '#fff' : c.muted,
                opacity: isLoading ? 0.5 : 1,
              }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ── Floating AI button ───────────────────────────────────────────────────────
export function AIFloatingButton() {
  const { toggleDrawer, isDrawerOpen, canUseAI } = useAIChat();
  const { currentColor, effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  if (!canUseAI || isDrawerOpen) return null;

  return (
    <button
      onClick={toggleDrawer}
      className="fixed z-[250] flex items-center justify-center rounded-2xl shadow-lg transition-all hover:scale-110 active:scale-95"
      style={{
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        right: 20,
        width: 52,
        height: 52,
        background: `linear-gradient(135deg, ${currentColor}, ${currentColor}dd)`,
        color: '#fff',
        boxShadow: `0 4px 20px ${currentColor}40`,
      }}
      title="AI Asistan"
    >
      <Sparkles size={22} />
    </button>
  );
}
