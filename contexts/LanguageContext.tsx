'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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

  // Trackers to prevent duplicates
  const knownUiKeys = useRef<Set<string>>(new Set());
  const knownUiValues = useRef<Set<string>>(new Set()); 
  const knownTags = useRef<Set<string>>(new Set());

  // Batching Queues
  const pendingUiInserts = useRef<Map<string, string>>(new Map());
  const pendingTagInserts = useRef<Map<string, { type: string, name: string }>>(new Map());
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchAllTranslations = async () => {
      const [langsRes, uiRes, tagsRes] = await Promise.all([
        supabase.from('app_languages').select('*').order('code'),
        supabase.from('ui_translations').select('*'),
        supabase.from('filter_options').select('*')
      ]);

      if (langsRes.data) setAppLanguages(langsRes.data);

      if (tagsRes.data) {
        tagsRes.data.forEach(tag => knownTags.current.add(tag.name.trim()));
      }

      if (uiRes.data) {
        const dict: Record<string, any> = {};
        uiRes.data.forEach(t => { 
          const jaValue = (t.values?.ja || '').trim();
          if (jaValue) knownUiValues.current.add(jaValue);
          knownUiKeys.current.add(t.translation_key);
          dict[t.translation_key] = t.values; 
        });
        setUiDictionary(dict);
      }
      
      setLoading(false);

      const savedLang = localStorage.getItem('eato_lang');
      if (savedLang && langsRes.data?.some(l => l.code === savedLang)) {
        setCurrentLang(savedLang);
      }
    };

    fetchAllTranslations();
  }, []);

  const setLanguage = (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem('eato_lang', lang);
  };

  const scheduleBatchSync = () => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);

    syncTimeout.current = setTimeout(async () => {
      const uiBatch = Array.from(pendingUiInserts.current.entries()).map(([k, v]) => ({
        translation_key: k,
        values: { ja: v }
      }));

      const tagBatch = Array.from(pendingTagInserts.current.values()).map(tag => ({
        name: tag.name,
        type: tag.type,
        translations: { ja: tag.name }
      }));

      pendingUiInserts.current.clear();
      pendingTagInserts.current.clear();

      if (uiBatch.length > 0) await supabase.from('ui_translations').insert(uiBatch);
      if (tagBatch.length > 0) await supabase.from('filter_options').insert(tagBatch);
      
      console.log(`[i18n] Batched sync complete.`);
    }, 2500); 
  };

  const t = (key: string, defaultText: string, variables?: Record<string, string | number>) => {
    
    if (!loading && process.env.NODE_ENV === 'development') {
      const cleanValue = defaultText.trim();

      if (key.startsWith('tag_')) {
        if (!knownTags.current.has(cleanValue) && !pendingTagInserts.current.has(cleanValue)) {
          let tagType = 'other';
          if (key.includes('_campus_')) tagType = 'campus';
          if (key.includes('_seats_')) tagType = 'seats';

          pendingTagInserts.current.set(cleanValue, { type: tagType, name: cleanValue });
          scheduleBatchSync();
        }
      } 
      else if (!knownUiKeys.current.has(key) && !knownUiValues.current.has(cleanValue) && !pendingUiInserts.current.has(key)) {
        pendingUiInserts.current.set(key, defaultText);
        knownUiValues.current.add(cleanValue); 
        scheduleBatchSync();
      }
    }

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