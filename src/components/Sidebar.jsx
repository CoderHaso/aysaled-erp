import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  TrendingUp, 
  ShoppingCart, 
  Settings, 
  Search,
  Bell,
  Menu,
  X
} from 'lucide-react';

const Sidebar = ({ isOpen, toggle }) => {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, active: true },
    { name: 'Stok Yönetimi', icon: Package },
    { name: 'Cari Takip', icon: Users },
    { name: 'Faturalar', icon: FileText },
    { name: 'Satış Paneli', icon: ShoppingCart },
    { name: 'Raporlar', icon: TrendingUp },
  ];

  return (
    <>
      <aside className={`fixed top-0 left-0 h-full bg-[#1e293b] text-white transition-all duration-300 z-50 overflow-hidden
        ${isOpen ? 'w-[280px]' : 'w-0 lg:w-[100px]'}`}>
        
        <div className="p-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/30">
            <TrendingUp className="text-white" size={24} />
          </div>
          <span className={`text-xl font-bold tracking-tight whitespace-nowrap transition-opacity ${!isOpen ? 'lg:opacity-0' : 'opacity-100'}`}>
            A-ERP <span className="text-primary-400">Pro</span>
          </span>
        </div>

        <nav className="px-4 space-y-2">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all hover:bg-white/5 group
                  ${item.active ? 'bg-primary-600 text-white' : 'text-slate-400'}`}
              >
                <Icon size={22} className={`${item.active ? 'text-white' : 'group-hover:text-white'}`} />
                <span className={`font-medium whitespace-nowrap transition-opacity ${!isOpen ? 'lg:hidden' : 'opacity-100'}`}>
                  {item.name}
                </span>
              </div>
            );
          })}
        </nav>

        <div className="absolute bottom-8 left-4 right-4 group">
          <div className={`flex items-center gap-4 px-4 py-4 rounded-3xl bg-slate-800/50 hover:bg-slate-800 transition-all border border-slate-700/50
             ${!isOpen ? 'lg:px-3 justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-slate-600 shrink-0 border-2 border-slate-500"></div>
            <div className={`${!isOpen ? 'lg:hidden' : 'opacity-100'} transition-opacity overflow-hidden`}>
              <p className="text-sm font-semibold truncate">Efe Han</p>
              <p className="text-xs text-slate-500 truncate">Admin</p>
            </div>
            <Settings className={`ml-auto text-slate-500 hover:text-white transition-colors ${!isOpen ? 'lg:hidden' : ''}`} size={18} />
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm lg:hidden z-40"
          onClick={toggle}
        />
      )}
    </>
  );
};

export default Sidebar;
