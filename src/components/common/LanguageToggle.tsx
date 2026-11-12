import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Languages } from 'lucide-react';

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ compact = false, className = '' }) => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer select-none active:scale-[0.96] border shadow-2xs min-h-[42px] min-w-[42px] ${
        language === 'ta'
          ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
      } ${className}`}
      title={language === 'en' ? 'தமிழுக்கு மாற அழுத்தவும் (Switch to Tamil)' : 'Switch to English (ஆங்கிலத்திற்கு மாற)'}
      aria-label="Toggle Language (English / Tamil)"
    >
      <Languages className="w-4 h-4 shrink-0" />
      <span className="text-xs tracking-tight font-extrabold">
        {language === 'en' ? (
          <>
            <span className="text-red-600 font-black">EN</span>
            <span className="text-slate-400 font-normal mx-0.5">/</span>
            <span className="text-slate-600 font-semibold">தமிழ்</span>
          </>
        ) : (
          <>
            <span className="text-white font-black">தமிழ்</span>
            <span className="text-red-200 font-normal mx-0.5">/</span>
            <span className="text-red-100 font-semibold">EN</span>
          </>
        )}
      </span>
    </button>
  );
};
