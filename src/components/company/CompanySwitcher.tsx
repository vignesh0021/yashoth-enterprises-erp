import React, { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useERP } from '../../context/ERPContext.tsx';
import { CompanyManagementModal } from './CompanyManagementModal.tsx';

export const CompanySwitcher: React.FC = () => {
  const { companies, activeCompanyId } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all text-left shadow-2xs group"
        title="Click to Switch Company or Manage Sister Entities"
      >
        <div className="p-1 rounded-lg bg-red-600 text-white shrink-0 group-hover:scale-105 transition-transform">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold text-xs text-slate-900 truncate max-w-[150px]">
              {activeCompany?.name || 'Yashoth Enterprises'}
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-700">
              {activeCompany?.code || 'YE'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">
            GSTIN: {activeCompany?.gstin ? activeCompany.gstin.substring(0, 7) + '...' : '33AXVPN...'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
      </button>

      {isModalOpen && (
        <CompanyManagementModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};
