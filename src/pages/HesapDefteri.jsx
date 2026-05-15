import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronDown, Plus, Search, Trash2, Edit3,
  TrendingUp, TrendingDown, X, Check, Loader2,
  Receipt, User, Building2, AlertCircle, CheckCircle2,
  ArrowUpDown, ChevronsUpDown, Printer
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation } from 'react-router-dom';
import { printDocument } from '../lib/printService';
import { useFxRates } from '../hooks/useFxRates';
import { trNorm } from '../lib/trNorm';

const fmtN = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const today = () => new Date().toISOString().slice(0, 10);
const CUR_SYM = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

const TABS = [
  { id: 'faturali_cari',       label: 'Faturalı Cari',        type: 'customer', faturasiz: false, icon: User      },
  { id: 'faturasiz_cari',      label: 'Faturasız Cari',       type: 'customer', faturasiz: true,  icon: User      },
  { id: 'faturali_tedarikci',  label: 'Faturalı Tedarikçi',  type: 'supplier', faturasiz: false, icon: Building2 },
  { id: 'faturasiz_tedarikci', label: 'Faturasız Tedarikçi', type: 'supplier', faturasiz: true,  icon: Building2 },
];

const colLabels = (type) => type === 'customer'
  ? { pos: 'Alacak',  neg: 'Alınan',  posTitle: 'Alacağımız', negTitle: 'Alınan (Tahsilat)' }
  : { pos: 'Verecek', neg: 'Verilen', posTitle: 'Ödeyeceğimiz', negTitle: 'Verilen (Ödeme)' };

const SORT_OPTIONS = [
  { id: 'az',        label: 'A → Z'          },
  { id: 'za',        label: 'Z → A'          },
  { id: 'alacak_d',  label: 'Alacak ↓ (büyük)' },
  { id: 'alacak_a',  label: 'Alacak ↑ (küçük)'  },
  { id: 'verecek_d', label: 'Verecek ↓ (büyük)' },
  { id: 'verecek_a', label: 'Verecek ↑ (küçük)'  },
  { id: 'yeni',      label: 'Son hareket (yeni)'  },
  { id: 'eski',      label: 'Son hareket (eski)'  },
];

// Tüm diğer tanımlar ve componentler aynı...

// Fonksiyon tanımı BAŞLANGICI (en sonda tekrar export default edilmesi gerek):
function HesapDefteri() {
  // ...tüm mevcut kod aynı şekilde burada bulunacak...
}

export default HesapDefteri;
