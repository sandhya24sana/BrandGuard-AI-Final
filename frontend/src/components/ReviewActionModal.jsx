import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, X, ShieldCheck } from 'lucide-react';

export default function ReviewActionModal({ isOpen, onClose, onSubmit, defaultDecision = 'approved', contentTitle }) {
  const [decision, setDecision] = useState(defaultDecision);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDecision(defaultDecision);
      setReviewerName('');
      setReviewerRole('');
      setComments('');
      setSubmissionError('');
    }
  }, [isOpen, defaultDecision]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError('');
    try {
      await onSubmit({
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        decision,
        comments
      });
      onClose();
    } catch (err) {
      setSubmissionError(err.message || 'Could not save this review decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Governance Review & Sign-Off</h3>
              <p className="text-xs text-slate-500 truncate max-w-sm">{contentTitle || 'Content Item'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submissionError && <p role="alert" className="text-xs text-rose-700">{submissionError}</p>}
          {/* Decision Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Review Decision
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision('approved')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  decision === 'approved'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mb-1 text-emerald-600" />
                <span>Approve</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision('changes_requested')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  decision === 'changes_requested'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <RotateCcw className="w-4 h-4 mb-1 text-amber-600" />
                <span>Request Changes</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision('rejected')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  decision === 'rejected'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <XCircle className="w-4 h-4 mb-1 text-rose-600" />
                <span>Reject</span>
              </button>
            </div>
          </div>

          {/* Reviewer Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reviewer Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                placeholder="Reviewer Name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role / Department</label>
              <input
                type="text"
                value={reviewerRole}
                onChange={(e) => setReviewerRole(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                placeholder="e.g. Brand Lead"
              />
            </div>
          </div>

          {/* Feedback & Comments */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Audit Notes & Feedback</label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 placeholder-slate-400"
              placeholder="State rationale for approval or specific instructions for revision..."
            />
          </div>

          {/* Modal Footer */}
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
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors ${
                decision === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : decision === 'rejected'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Record Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
