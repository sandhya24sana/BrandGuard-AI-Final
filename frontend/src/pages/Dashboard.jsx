import React, { useState, useEffect } from 'react';
import { 
  FileText, ShieldCheck, CheckCircle2, AlertOctagon, 
  ArrowRight, Sparkles, BookOpen, AlertTriangle, Clock
} from 'lucide-react';
import { api } from '../api';

export default function Dashboard({
  brandId,
  brands = [],
  onNavigateToAnalyzer,
  onNavigateToGuidelines,
  onInspectAudit
}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedBrand = brands.find((b) => b.id === brandId) || brands[0];

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDashboardStats(brandId);
      if (res.success) {
        setStats(res);
      } else {
        setError(res.error || 'Could not load dashboard analytics.');
      }
    } catch (err) {
      setError(err.message || 'Could not load dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [brandId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Loading governance dashboard...
      </div>
    );
  }
  if (error || !stats) {
    return <div role="alert" className="p-8 text-center text-rose-700 text-xs">{error || 'No dashboard data is available.'}</div>;
  }

  const approvalCount = stats.status_breakdown?.approved || 0;
  const totalScanned = stats.total_scanned || 0;
  const approvalRate = totalScanned > 0 ? Math.round((approvalCount / totalScanned) * 100) : 0;
  const ruleCount = (selectedBrand?.facts_count || 0)
    + (selectedBrand?.terminology_count || 0)
    + (selectedBrand?.claim_count || 0);

  return (
    <div className="space-y-6">
      {/* Clean Brand Overview Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Active Brand Governance
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {selectedBrand?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {[selectedBrand?.tagline, selectedBrand?.primary_tone].filter(Boolean).join(' • ')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateToAnalyzer}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Audit Copy</span>
          </button>
          <button
            onClick={onNavigateToGuidelines}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Guidelines</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Audits</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total_scanned}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Content audits for this brand</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Avg Compliance Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.average_score}/100</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Brand integrity index</span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Approval Rate</span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{approvalRate}%</div>
          <span className="text-[11px] text-slate-400 mt-1 block">{approvalCount} approved for publishing</span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Policy Rules</span>
            <AlertOctagon className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {ruleCount}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Facts, terminology & claims</span>
        </div>
      </div>

      {/* Two Column Section: Violations Breakdown & Banned Vocabulary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Violation Categories */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Violations by Category
            </h3>
            <span className="text-[11px] text-slate-400">Selected brand history</span>
          </div>

          <div className="space-y-3 pt-1">
            {Object.entries(stats.violation_categories || {}).map(([cat, count]) => {
              const maxCount = Math.max(...Object.values(stats.violation_categories || { a: 1 }), 1);
              const percentage = Math.round((count / maxCount) * 100);

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{cat}</span>
                    <span className="font-mono text-slate-500 font-semibold">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        cat === 'Fact Accuracy' ? 'bg-rose-500' :
                        cat === 'Compliance & Claims' ? 'bg-orange-500' :
                        cat === 'Terminology' ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${count ? Math.max(6, percentage) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Flagged Terms */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Most Flagged Banned Terms
            </h3>
            <span className="text-[11px] text-slate-400">Frequency</span>
          </div>

          <div className="space-y-2 pt-1">
            {stats.top_prohibited_terms && stats.top_prohibited_terms.length > 0 ? (
              stats.top_prohibited_terms.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="font-mono font-semibold text-rose-700">"{item.term}"</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px] font-medium">
                    {item.count} hits
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                No banned terms detected yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Recent Content Audits
            </h3>
          </div>
          <button
            onClick={onNavigateToAnalyzer}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>Open Workspace</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 font-semibold">Title</th>
                <th className="py-2.5 px-4 font-semibold">Format</th>
                <th className="py-2.5 px-4 font-semibold">Score</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Version</th>
                <th className="py-2.5 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recent_items && stats.recent_items.length > 0 ? (
                stats.recent_items.slice(0, 4).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.content_type}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      <span className={item.risk_score >= 90 ? 'text-emerald-700' : item.risk_score >= 75 ? 'text-amber-700' : 'text-rose-700'}>
                        {item.risk_score}/100
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      v{item.current_version}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onInspectAudit(item.id)}
                        className="text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No recent scans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
