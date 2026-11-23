import React from 'react';
import { Menu, ChevronDown, Plus, Building2 } from 'lucide-react';

export default function Header({
  brands = [],
  selectedBrandId,
  setSelectedBrandId,
  onOpenSidebar,
  onNewScan,
  onCreateBrand,
  currentTab
}) {
  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Executive Dashboard';
      case 'analyzer': return 'Content Governance Analyzer';
      case 'guidelines': return 'Brand Guidelines & Knowledge Base';
      case 'reviews': return 'Review History & Audit Trail';
      default: return 'Brand Governance';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Brand / Organization Switcher */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedBrandId || ''}
              onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : null)}
              disabled={brands.length === 0}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-4 appearance-none"
              aria-label="Select Active Brand"
            >
              {brands.length === 0 && <option value="">No brands</option>}
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none -ml-3" />
          </div>
        </div>

        <button
          onClick={onCreateBrand}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Brand</span>
        </button>

        {/* Quick Action: New Scan Button */}
        <button
          onClick={onNewScan}
          disabled={brands.length === 0}
          aria-label="New Scan"
          title="New Scan"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg shadow-xs transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="sm:hidden">Scan</span>
          <span className="hidden sm:inline">New Scan</span>
        </button>

      </div>
    </header>
  );
}
