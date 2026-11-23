import React, { useEffect, useState } from 'react';
import { X, BookOpen, AlertOctagon, Scale } from 'lucide-react';

export default function GuidelineModal({
  isOpen,
  onClose,
  type,
  brandId,
  record = null,
  onSubmit,
}) {
  const [statement, setStatement] = useState('');
  const [category, setCategory] = useState(type === 'fact' ? 'Company Stats' : 'Terminology');
  const [keyMetric, setKeyMetric] = useState('');
  const [keywords, setKeywords] = useState('');

  // For terminology
  const [term, setTerm] = useState('');
  const [replacement, setReplacement] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('warning');

  // For claims
  const [ruleName, setRuleName] = useState('');
  const [pattern, setPattern] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [claimReplacement, setClaimReplacement] = useState('');
  const [explanation, setExplanation] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStatement(record?.statement || '');
    setCategory(record?.category || (type === 'fact' ? 'Company Stats' : 'Terminology'));
    setKeyMetric(record?.key_metric || '');
    setKeywords(record?.keywords || '');
    setTerm(record?.term || '');
    setReplacement(record?.replacement || record?.replacement_text || '');
    setReason(record?.reason || '');
    setSeverity(record?.severity || (type === 'claim' ? 'critical' : 'warning'));
    setRuleName(record?.rule_name || '');
    setPattern(record?.pattern_or_trigger || '');
    setDisclaimer(record?.required_disclaimer || '');
    setClaimReplacement(record?.replacement_text || '');
    setExplanation(record?.explanation || '');
    setError('');
  }, [isOpen, record, type]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      if (type === 'fact') {
        await onSubmit({
          category,
          statement,
          key_metric: keyMetric,
          keywords
        });
      } else if (type === 'terminology') {
        await onSubmit({
          term,
          replacement,
          replacement_text: replacement.includes('/') ? '' : replacement,
          reason,
          category,
          severity
        });
      } else if (type === 'claim') {
        await onSubmit({
          rule_name: ruleName,
          pattern_or_trigger: pattern,
          severity,
          required_disclaimer: disclaimer,
          replacement_text: claimReplacement,
          explanation
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save guideline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    if (type === 'fact') return {
      title: record ? 'Edit Approved Brand Fact' : 'Add Approved Brand Fact',
      icon: BookOpen,
      desc: 'Official truth metric against which copy is validated.',
    };
    if (type === 'terminology') return {
      title: record ? 'Edit Prohibited Term & Alternative' : 'Add Prohibited Term & Alternative',
      icon: AlertOctagon,
      desc: 'Restrict slang or legal risks and supply preferred replacements.',
    };
    return {
      title: record ? 'Edit Compliance & Claim Rule' : 'Add Compliance & Claim Rule',
      icon: Scale,
      desc: 'Prohibit absolute guarantees and enforce required disclaimers.',
    };
  };

  const info = getTitle();
  const Icon = info.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{info.title}</h3>
              <p className="text-xs text-slate-500">{info.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
          {type === 'fact' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fact Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="Company Stats">Company Stats & History</option>
                  <option value="Product Specs">Product Specs & Performance</option>
                  <option value="Certifications">Certifications & Security</option>
                  <option value="Customer Base">Customer Base & Scale</option>
                  <option value="Financials">Financials & Pricing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Approved Statement *</label>
                <textarea
                  rows={3}
                  required
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 placeholder-slate-400"
                  placeholder="e.g. ApexCloud was founded in 2018 in San Francisco, California."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Key Number / Metric</label>
                  <input
                    type="text"
                    value={keyMetric}
                    onChange={(e) => setKeyMetric(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="e.g. Founded 2018"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Search Keywords</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="e.g. founded, 2018, headquarters"
                  />
                </div>
              </div>
            </>
          )}

          {type === 'terminology' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Forbidden Term *</label>
                  <input
                    type="text"
                    required
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-rose-700 font-mono focus:outline-none focus:border-blue-600"
                    placeholder="e.g. cheap"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Approved Replacement *</label>
                  <input
                    type="text"
                    required
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-emerald-700 font-mono focus:outline-none focus:border-blue-600"
                    placeholder="e.g. cost-effective"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Terminology">Off-Brand Vocabulary</option>
                    <option value="Jargon">Hype / Jargon</option>
                    <option value="Legal & Claims">Legal / Warranty Risk</option>
                    <option value="Competitor">Competitor Slur</option>
                    <option value="Brand Tone">Tone Inconsistency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Policy Rationale</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 placeholder-slate-400"
                  placeholder="Explain why this word is prohibited..."
                />
              </div>
            </>
          )}

          {type === 'claim' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="e.g. Absolute Guarantee Prohibition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trigger Expression / Pattern *</label>
                  <input
                    type="text"
                    required
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="e.g. 100% (guaranteed|bug-free)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Required Disclaimer</label>
                <input
                  type="text"
                  value={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="Optional disclaimer requirement; not applied as replacement text."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Approved Replacement Text</label>
                <input
                  type="text"
                  value={claimReplacement}
                  onChange={(e) => setClaimReplacement(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="Optional exact text to replace the matched claim."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Compliance Explanation</label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="Legal risk context..."
                />
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
            >
              {isSubmitting
                ? 'Saving...'
                : record
                ? 'Save Changes'
                : type === 'fact'
                ? 'Add Fact'
                : type === 'terminology'
                ? 'Add Term'
                : 'Add Claim Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
