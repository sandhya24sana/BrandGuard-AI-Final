import React, { useEffect, useState } from 'react';
import { Building2, X } from 'lucide-react';

const emptyBrand = {
  name: '',
  description: '',
  industry: '',
  tagline: '',
  primary_tone: '',
  voice_traits: '',
  target_audience: ''
};

export default function CreateBrandModal({ isOpen, onClose, onSubmit }) {
  const [brand, setBrand] = useState(emptyBrand);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBrand(emptyBrand);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...brand,
        voice_traits: brand.voice_traits.split(',').map((trait) => trait.trim()).filter(Boolean)
      });
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Could not create brand.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field) => (event) => setBrand({ ...brand, [field]: event.target.value });
  const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Create Brand</h2>
              <p className="text-xs text-slate-500">Enter your brand profile and voice guidelines.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-medium text-slate-700">
            Brand name *
            <input autoFocus required maxLength={150} value={brand.name} onChange={update('name')} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Industry
            <input value={brand.industry} onChange={update('industry')} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-700 sm:col-span-2">
            Description
            <textarea rows={2} value={brand.description} onChange={update('description')} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Tagline
            <input value={brand.tagline} onChange={update('tagline')} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Primary tone
            <input value={brand.primary_tone} onChange={update('primary_tone')} className={`${inputClass} mt-1`} placeholder="Set your tone" />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Voice traits
            <input value={brand.voice_traits} onChange={update('voice_traits')} className={`${inputClass} mt-1`} placeholder="Comma-separated traits" />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Target audience
            <input value={brand.target_audience} onChange={update('target_audience')} className={`${inputClass} mt-1`} />
          </label>
        </div>

        {error && <p role="alert" className="mx-6 mb-3 text-xs text-rose-700">{error}</p>}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create Brand'}
          </button>
        </div>
      </form>
    </div>
  );
}
