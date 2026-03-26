'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

type LanguageContextType = {
  currentLang: string;
  setLanguage: (lang: string) => void;
  appLanguages: any[];
  t: (key: string, defaultText: string, variables?: Record<string, string | number>) => string;
  loading: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLang, setCurrentLang] = useState('ja');
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiDictionary, setUiDictionary] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTranslations = async () => {
      const { data: langs } = await supabase.from('app_languages').select('*').order('code');
      if (langs) setAppLanguages(langs);

      const { data: trans } = await supabase.from('ui_translations').select('*');
      if (trans) {
        const dict: Record<string, any> = {};
        trans.forEach(t => { dict[t.translation_key] = t.values; });
        setUiDictionary(dict);
      }
      
      setLoading(false);

      const savedLang = localStorage.getItem('eato_lang');
      if (savedLang && langs?.some(l => l.code === savedLang)) {
        setCurrentLang(savedLang);
      }
    };

    fetchTranslations();
  }, []);

  const setLanguage = (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem('eato_lang', lang);
  };

  const t = (key: string, defaultText: string, variables?: Record<string, string | number>) => {
    let text = uiDictionary[key]?.[currentLang] || defaultText;
    
    if (variables) {
      Object.keys(variables).forEach(vKey => {
        text = text.replace(`{{${vKey}}}`, String(variables[vKey]));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage, appLanguages, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}