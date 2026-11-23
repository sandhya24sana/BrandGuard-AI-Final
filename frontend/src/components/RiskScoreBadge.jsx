import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function RiskScoreBadge({ score = 0, riskLevel = 'LOW', subScores = {}, size = 'md' }) {
  let color = 'emerald';
  let Icon = CheckCircle2;
  let label = 'Low Risk';

  if (score < 50 || riskLevel === 'CRITICAL') {
    color = 'rose';
    Icon = ShieldAlert;
    label = 'Critical Risk';
  } else if (score < 75 || riskLevel === 'HIGH') {
    color = 'orange';
    Icon = AlertTriangle;
    label = 'High Risk';
  } else if (score < 90 || riskLevel === 'MODERATE') {
    color = 'amber';
    Icon = AlertTriangle;
    label = 'Moderate Risk';
  } else {
    color = 'emerald';
    Icon = CheckCircle2;
    label = 'Low Risk';
  }

  const themes = {
    rose: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      stroke: '#e11d48',
      text: 'text-rose-600',
      fill: 'bg-rose-600'
    },
    orange: {
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      stroke: '#ea580c',
      text: 'text-orange-600',
      fill: 'bg-orange-600'
    },
    amber: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      stroke: '#d97706',
      text: 'text-amber-600',
      fill: 'bg-amber-600'
    },
    emerald: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      stroke: '#059669',
      text: 'text-emerald-600',
      fill: 'bg-emerald-600'
    }
  };

  const theme = themes[color];

  // Radial progress calculations
  const radius = size === 'sm' ? 22 : 32;
  const strokeWidth = size === 'sm' ? 4 : 5;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3.5">
        {/* Radial Minimal Ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="rotate-[-90deg] transition-all duration-500 ease-out"
          >
            <circle
              stroke="#e2e8f0"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke={theme.stroke}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`font-bold ${size === 'sm' ? 'text-xs' : 'text-base'} ${theme.text}`}>
              {score}
            </span>
          </div>
        </div>

        {/* Badge & Label */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${theme.badge}`}>
              <Icon className="w-3 h-3" />
              {riskLevel || label}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {score >= 90 ? 'Compliant & ready to publish' : score >= 75 ? 'Minor policy revisions suggested' : 'Direct policy violations detected'}
          </div>
        </div>
      </div>

      {/* Sub-scores mini bars */}
      {subScores && Object.keys(subScores).length > 0 && size !== 'sm' && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Governance Categories
          </div>

          {[
            { key: 'facts', label: 'Fact Accuracy', val: subScores.facts ?? 100 },
            { key: 'claims', label: 'Claim Safety', val: subScores.claims ?? 100 },
            { key: 'terminology', label: 'Terminology', val: subScores.terminology ?? 100 },
            { key: 'tone', label: 'Voice & Tone', val: subScores.tone ?? 100 },
            { key: 'accessibility', label: 'Accessibility', val: subScores.accessibility ?? 100 }
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between text-xs">
              <span className="text-slate-600 w-28 truncate">{item.label}</span>
              <div className="flex-1 mx-3 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.val >= 85 ? 'bg-emerald-500' : item.val >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${item.val}%` }}
                />
              </div>
              <span className="text-slate-500 font-mono text-[11px] w-8 text-right font-medium">
                {item.val}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
