import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    label: string;
    positive: boolean;
  };
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  highlight,
}) => {
  return (
    <div
      className={`rounded-xl p-5 border transition-all duration-200 shadow-sm ${
        highlight
          ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700'
          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${highlight ? 'text-slate-300' : 'text-slate-500'}`}>
          {title}
        </span>
        <div className={`p-2 rounded-lg ${highlight ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        {subtext && (
          <p className={`mt-1 text-xs ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>
            {subtext}
          </p>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          <span className={trend.positive ? 'text-emerald-500' : 'text-rose-500'}>
            {trend.positive ? '↑' : '↓'} {trend.label}
          </span>
          <span className={highlight ? 'text-slate-400' : 'text-slate-400'}>vs yesterday</span>
        </div>
      )}
    </div>
  );
};
