import React from 'react';
import { Shield, Sparkles, Sliders, CheckSquare, BarChart3, Plus, ChevronDown, CheckCircle2, Cpu } from 'lucide-react';

export default function Navbar({
  currentTab,
  setCurrentTab,
  brands = [],
  selectedBrandId,
  setSelectedBrandId,
  systemStatus,
  onNewScan
}) {
  const selectedBrand = brands.find((b) => b.id === selectedBrandId) || brands[0];

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'analyzer', label: 'Content Analyzer', icon: Sparkles },
    { id: 'guidelines', label: 'Brand Guidelines', icon: Sliders },
    { id: 'reviews', label: 'Review Audit Log', icon: CheckSquare },
  ];

  const isAiActive = systemStatus?.ai_configured;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">BrandGuard</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none">Intelligent Brand Governance</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Brand Switcher & Engine Status & Quick Action */}
          <div className="flex items-center gap-3">
            {/* Active Brand Selector */}
            <div className="relative">
              <select
                value={selectedBrandId || ''}
                onChange={(e) => setSelectedBrandId(Number(e.target.value))}
                aria-label="Active Brand"
                className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-xs font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* AI / Rule-Engine Status Pill */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium ${
                isAiActive
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
              title={systemStatus?.mode || 'Governance Engine'}
            >
              <Cpu className="w-3.5 h-3.5 animate-pulse" />
              <span>{isAiActive ? 'AI Hybrid Engine' : 'Rule-Based Engine'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5"></span>
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => {
                setCurrentTab('analyzer');
                if (onNewScan) onNewScan();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-1.5 bg-slate-950">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium rounded-lg ${
                isActive ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
