import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  Search, 
  Bell, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  Users, 
  FileText,
  CreditCard,
  ShoppingCart,
  RefreshCcw
} from 'lucide-react';
import Sidebar from './components/Sidebar';

const Dashboard = () => {
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Dev: Vite proxy → localhost:3001 | Prod: Vercel Serverless /api/get-invoices
      const response = await axios.post('/api/get-invoices');
      setInvoices(response.data);
    } catch (err) {
      console.error(err);
      alert("Backend bağlantı hatası! (dev'de node index.js çalışıyor mu?)");
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    { name: 'Toplam Stok', value: '1,248', change: '+12%', type: 'up', icon: Package, color: 'bg-blue-500' },
    { name: 'Aktif Cariler', value: '42', change: '+3', type: 'up', icon: Users, color: 'bg-emerald-500' },
    { name: 'Aylık Satış', value: '₺84.200', change: '-5%', type: 'down', icon: FileText, color: 'bg-purple-500' },
    { name: 'Kasa Dengesi', value: '$12.450', change: '+₺2k', type: 'up', icon: CreditCard, color: 'bg-orange-500' },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-app)', color: 'var(--text-base)' }}>
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-[260px]' : 'ml-0 lg:ml-[72px]'}`}>
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b px-6 py-4 flex items-center justify-between"
          style={{
            background: 'var(--bg-header)',
            backdropFilter: 'blur(12px)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200 focus-within:ring-2 ring-primary-500/20 transition-all">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Evrak, ürün veya cari ara..." 
                className="bg-transparent border-none outline-none text-sm w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="btn-primary flex items-center gap-2">
              <Plus size={18} />
              <span>Yeni İşlem</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Hoş Geldin, Efe</h1>
              <p className="text-slate-500 font-medium">A-ERP Sistem Özetin ve Hızlı Aksiyonlar</p>
            </div>
            <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <button onClick={fetchInvoices} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                Uyumsoft Senkronizasyonu
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((m, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 group hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-2xl ${m.color} text-white shadow-lg`}>
                    <m.icon size={24} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${m.type === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    {m.type === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {m.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{m.name}</p>
                  <p className="text-2xl font-bold mt-1 text-slate-900">{m.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Uyumsoft Faturalar Kartı */}
            <div className="lg:col-span-2 glass-card p-8 min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold">Son Gelen Faturalar</h3>
                  <p className="text-sm text-slate-500">Uyumsoft API'den çekilen son kayıtlar</p>
                </div>
                <button className="text-primary-600 text-sm font-bold hover:underline">Tümünü Gör</button>
              </div>

              {!invoices && !loading && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
                  <FileText size={48} strokeWidth={1} />
                  <p className="mt-4 font-medium">Fatura listesini görmek için senkronize et butonuna basınız.</p>
                </div>
              )}

              {loading && <div className="text-center py-20 font-bold text-slate-500">Veriler çekiliyor...</div>}

              {invoices && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-sm uppercase font-bold tracking-wider">
                        <th className="pb-4">Gönderici / Belge No</th>
                        <th className="pb-4">Tarih</th>
                        <th className="pb-4">Tutar</th>
                        <th className="pb-4">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Burada gelen veriyi map'leyeceğiz. Result yapısına göre dinamikleştirilecek. */}
                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-5 font-semibold text-slate-900">Uyumsoft Test Müşterisi</td>
                        <td className="py-5 text-slate-500">26.03.2026</td>
                        <td className="py-5 font-bold text-slate-900">₺15.450,00</td>
                        <td className="py-5">
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Onaylandı</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="bg-slate-50 p-4 rounded-2xl mt-6">
                     <pre className="text-[10px] text-slate-400 overflow-x-auto">{JSON.stringify(invoices, null, 2).substring(0, 500)}...</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions & News */}
            <div className="space-y-6">
              <div className="glass-card p-6 bg-primary-900 text-white overflow-hidden relative">
                <div className="relative z-10">
                  <h3 className="text-lg font-bold">Premium ERP</h3>
                  <p className="text-blue-200 text-sm mt-1">Uyumsoft entegrasyonu aktif. Her şey yolunda.</p>
                  <button className="mt-6 bg-white text-primary-900 px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-black/20">Abonelik Yönetimi</button>
                </div>
                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              </div>

              <div className="glass-card p-6">
                <h3 className="font-bold mb-4">Hızlı Aksiyonlar</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { n: 'Satış Yap', i: ShoppingCart, c: 'bg-blue-50 text-blue-600' },
                    { n: 'Stok Ekle', i: Plus, c: 'bg-orange-50 text-orange-600' },
                    { n: 'Cari Ara', i: Search, c: 'bg-emerald-50 text-emerald-600' },
                    { n: 'Gelen Kutusu', i: FileText, c: 'bg-purple-50 text-purple-600' },
                  ].map((act, i) => (
                    <button key={i} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-transparent hover:border-slate-100 transition-all ${act.c}`}>
                      <act.i size={20} />
                      <span className="text-xs font-bold">{act.n}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const App = () => {
  return <Dashboard />;
};

export default App;
