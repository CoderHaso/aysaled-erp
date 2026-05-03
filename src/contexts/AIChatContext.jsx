/**
 * AIChatContext.jsx
 * AI Asistan durum yönetimi — konuşma geçmişi, mesaj gönderme, drawer kontrolü
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const AIChatContext = createContext();

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AIChatProvider({ children }) {
  const { profile } = useAuth();

  // Drawer / fullscreen kontrolü
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sayfa bağlamı toggle
  const [usePageContext, setUsePageContext] = useState(true);
  const [currentPage, setCurrentPage] = useState('');

  // Konuşma durumu
  const [conversationId, setConversationId] = useState(() => generateId());
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Konuşma listesi (geçmiş)
  const [conversations, setConversations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Abort controller ref
  const abortRef = useRef(null);

  // Rol kontrolü — Atolye kullanıcıları AI kullanamaz
  const canUseAI = profile && profile.role !== 'Atolye';

  // ── Mesaj gönder ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isLoading) return;

    const userMsg = { id: generateId(), role: 'user', content, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    // API'ye gönderilecek mesaj geçmişi (role + content only)
    const apiMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          conversationId,
          pageContext: usePageContext ? currentPage : null,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Sunucu hatası (${res.status})`);
      }

      const data = await res.json();

      const assistantMsg = {
        id: generateId(),
        role: 'assistant',
        content: data.message || '',
        toolsUsed: data.toolsUsed || [],
        model: data.model,
        fallback: data.fallback || false,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[AIChatContext] Error:', err);
      setError(err.message);
      // Hata mesajını chat'e ekle
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Hata: ${err.message}`,
        isError: true,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, conversationId, usePageContext, currentPage, isLoading]);

  // ── İptal et ────────────────────────────────────────────────────────────────
  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  // ── Yeni konuşma başlat ────────────────────────────────────────────────────
  const startNewConversation = useCallback(() => {
    setConversationId(generateId());
    setMessages([]);
    setError(null);
  }, []);

  // ── Geçmiş konuşmaları yükle ──────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, title, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(30);
      setConversations(data || []);
    } catch (err) {
      console.error('[loadConversations]', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ── Belirli bir konuşmayı yükle ───────────────────────────────────────────
  const loadConversation = useCallback(async (convId) => {
    try {
      const { data } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at');

      if (data && data.length > 0) {
        setConversationId(convId);
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolsUsed: m.tools_used || [],
          pageContext: m.page_context,
          timestamp: m.created_at,
        })));
        setError(null);
      }
    } catch (err) {
      console.error('[loadConversation]', err);
    }
  }, []);

  // ── Konuşma sil ───────────────────────────────────────────────────────────
  const deleteConversation = useCallback(async (convId) => {
    try {
      await supabase.from('ai_messages').delete().eq('conversation_id', convId);
      await supabase.from('ai_conversations').delete().eq('id', convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (convId === conversationId) startNewConversation();
    } catch (err) {
      console.error('[deleteConversation]', err);
    }
  }, [conversationId, startNewConversation]);

  // ── Drawer toggle ─────────────────────────────────────────────────────────
  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen(prev => !prev);
    setIsFullscreen(false);
  }, []);

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
    setIsFullscreen(false);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const value = {
    // Drawer state
    isDrawerOpen, isFullscreen,
    toggleDrawer, openDrawer, closeDrawer, toggleFullscreen,

    // Page context
    usePageContext, setUsePageContext,
    currentPage, setCurrentPage,

    // Chat state
    conversationId, messages, isLoading, error,
    sendMessage, cancelRequest, startNewConversation,

    // History
    conversations, loadingHistory,
    loadConversations, loadConversation, deleteConversation,

    // Role check
    canUseAI,
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  return useContext(AIChatContext);
}
