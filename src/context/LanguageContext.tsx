import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TRANSLATIONS, type AppLanguage } from '../i18n/translations.ts';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
}

const STORAGE_KEY = 'ye_language_preference';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage;
        if (saved === 'en' || saved === 'ta') {
          return saved;
        }
      }
    } catch {}
    return 'en';
  });

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev: AppLanguage) => {
      const next: AppLanguage = prev === 'en' ? 'ta' : 'en';
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, next);
        }
      } catch {}
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
      if (dict && dict[key]) {
        return dict[key];
      }
      // Fallback to English dictionary if key missing in Tamil
      if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
        return TRANSLATIONS.en[key];
      }
      return defaultText !== undefined ? defaultText : key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslation = useLanguage;
