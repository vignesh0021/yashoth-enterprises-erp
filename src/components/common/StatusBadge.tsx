import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const s = status.toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['POSTED', 'PAID', 'APPROVED', 'VERIFIED', 'COMPLETED', 'ACTIVE', 'PRESENT'].includes(s)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['DRAFT', 'PENDING', 'REQUESTED', 'UNPAID'].includes(s)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['SUBMITTED', 'CONFIRMED', 'ASSIGNED', 'IN_TRANSIT', 'DISPATCHED', 'PARTIALLY_PAID', 'HALF_DAY', 'OVERTIME'].includes(s)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['CANCELLED', 'REJECTED', 'FLAGGED', 'ABSENT', 'STOCK_LOSS'].includes(s)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}>
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
      {label}
    </span>
  );
};
