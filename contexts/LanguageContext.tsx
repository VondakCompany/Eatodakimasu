'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

type LanguageContextType = {
  currentLang: string;
  setLanguage: (lang: string) => void;
  appLanguages: any[];
  t: (key: string, defaultText: string) => string;
  loading: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLang, setCurrentLang] = useState('ja'); // Always default to Japanese
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiDictionary, setUiDictionary] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTranslations = async () => {
      // 1. Fetch available languages
      const { data: langs } = await supabase.from('app_languages').select('*').order('code');
      if (langs) setAppLanguages(langs);

      // 2. Fetch the entire UI dictionary
      const { data: trans } = await supabase.from('ui_translations').select('*');
      if (trans) {
        const dict: Record<string, any> = {};
        trans.forEach(t => { dict[t.translation_key] = t.values; });
        setUiDictionary(dict);
      }
      
      setLoading(false);

      // 3. Check if the user visited before and has a saved language preference
      const savedLang = localStorage.getItem('eato_lang');
      if (savedLang && langs?.some(l => l.code === savedLang)) {
        setCurrentLang(savedLang);
      }
    };

    fetchTranslations();
  }, []);

  // Update language and save to local storage so it survives page refreshes
  const setLanguage = (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem('eato_lang', lang);
  };

  // The magical Translation Function: t('ui_key', 'Fallback Text')
  const t = (key: string, defaultText: string) => {
    return uiDictionary[key]?.[currentLang] || defaultText;
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage, appLanguages, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}