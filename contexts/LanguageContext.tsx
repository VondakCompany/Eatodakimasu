'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ja' | 'en';

// The dictionary for pure UI text
export const DICT = {
  ja: {
    searchPlaceholder: 'レストラン名、メニュー、エリアで検索...',
    filters: '絞り込み条件',
    reset: 'リセット',
    price: '予算 (Price)',
    noLimit: '上限なし',
    below: '以下',
    cuisine: 'ジャンル (Cuisine)',
    dietary: '食事制限 (Dietary)',
    payment: '決済方法 (Payment)',
    options: 'その他 (Options)',
    stampRally: 'スタンプラリー参加店舗',
    results: '検索結果',
    items: '件',
    searching: '検索中...',
    notFound: 'お店が見つかりませんでした',
    notFoundDesc: '指定した条件に一致するレストランがありません。検索キーワードを変えるか、フィルターを解除してみてください。',
    clearAll: '条件をすべてクリア',
    back: '← 検索に戻る',
    info: '店舗情報',
    takeout: 'テイクアウト',
    takeoutAvailable: 'テイクアウト対応',
    takeoutUnavailable: 'テイクアウト不可',
  },
  en: {
    searchPlaceholder: 'Search restaurants, menus, or areas...',
    filters: 'Filters',
    reset: 'Reset',
    price: 'Budget',
    noLimit: 'No limit',
    below: 'or less',
    cuisine: 'Cuisine',
    dietary: 'Dietary',
    payment: 'Payment',
    options: 'Options',
    stampRally: 'Stamp Rally Participant',
    results: 'Results',
    items: 'items',
    searching: 'Searching...',
    notFound: 'No restaurants found',
    notFoundDesc: 'No restaurants match your current filters. Try changing your keywords or clearing the filters.',
    clearAll: 'Clear all filters',
    back: '← Back to Search',
    info: 'Information',
    takeout: 'Takeout',
    takeoutAvailable: 'Takeout Available',
    takeoutUnavailable: 'No Takeout',
  }
};

// The mapping for database filters (UI Label -> DB Value)
export const FILTER_OPTIONS = {
  cuisines: [
    { id: '和食', ja: '和食', en: 'Japanese' },
    { id: '洋食', ja: '洋食', en: 'Western' },
    { id: '中華', ja: '中華', en: 'Chinese' },
    { id: '韓国料理', ja: '韓国料理', en: 'Korean' },
    { id: 'インド料理', ja: 'インド料理', en: 'Indian' },
    { id: '東南アジア', ja: '東南アジア', en: 'SE Asian' },
    { id: 'ファストフード', ja: 'ファストフード', en: 'Fast Food' },
    { id: 'カフェ・スイーツ', ja: 'カフェ・スイーツ', en: 'Cafe/Sweets' },
  ],
  restrictions: [
    { id: 'ハラール', ja: 'ハラール', en: 'Halal' },
    { id: 'ヴィーガン', ja: 'ヴィーガン', en: 'Vegan' },
    { id: 'ベジタリアン', ja: 'ベジタリアン', en: 'Vegetarian' },
    { id: 'グルテンフリー', ja: 'グルテンフリー', en: 'Gluten-Free' },
    { id: '乳製品不使用', ja: '乳製品不使用', en: 'Dairy-Free' },
    { id: 'ペスカタリアン', ja: 'ペスカタリアン', en: 'Pescatarian' },
  ],
  payments: [
    { id: '現金', ja: '現金', en: 'Cash' },
    { id: 'クレジットカード', ja: 'クレジットカード', en: 'Credit Card' },
    { id: 'QRコード決済', ja: 'QRコード決済', en: 'QR Code' },
    { id: '電子マネー', ja: '電子マネー', en: 'E-Money' },
  ]
};

const LanguageContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof DICT['ja'];
}>({
  lang: 'ja',
  setLang: () => {},
  t: DICT['ja'],
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('ja');

  // Persist language choice in local storage so it remembers across pages
  useEffect(() => {
    const saved = localStorage.getItem('eato_lang') as Language;
    if (saved) setLang(saved);
  }, []);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('eato_lang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t: DICT[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);