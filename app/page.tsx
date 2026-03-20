'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RestaurantCard from '@/components/RestaurantCard';
import { useLanguage } from '@/contexts/LanguageContext';

const FILTER_OPTIONS = {
  cuisines: [
    { id: '和食', ja: '和食', en: 'Japanese' },
    { id: '洋食', ja: '洋食', en: 'Western' },
    { id: '中華', ja: '中華', en: 'Chinese' },
    { id: '韓国料理', ja: '韓国料理', en: 'Korean' },
    { id: 'インド料理', ja: 'インド料理', en: 'Indian' },
    { id: '東南アジア', ja: '東南アジア', en: 'Southeast Asian' },
    { id: 'ファストフード', ja: 'ファストフード', en: 'Fast Food' },
    { id: 'カフェ・スイーツ', ja: 'カフェ・スイーツ', en: 'Cafe/Sweets' },
    { id: '寿司', ja: '寿司', en: 'Sushi' },
    { id: '丼もの', ja: '丼もの', en: 'Rice Bowls' }
  ],
  restrictions: [
    { id: 'ハラール', ja: 'ハラール', en: 'Halal' },
    { id: 'コーシャ', ja: 'コーシャ', en: 'Kosher' },
    { id: 'ヴィーガン', ja: 'ヴィーガン', en: 'Vegan' },
    { id: 'ベジタリアン', ja: 'ベジタリアン', en: 'Vegetarian' },
    { id: 'グルテンフリー', ja: 'グルテンフリー', en: 'Gluten-Free' },
    { id: '乳製品不使用', ja: '乳製品不使用', en: 'Dairy-Free' },
    { id: 'ペスカタリアン', ja: 'ペスカタリアン', en: 'Pescatarian' }
  ],
  payments: [
    { id: '現金', ja: '現金', en: 'Cash' },
    { id: 'クレジットカード', ja: 'クレジットカード', en: 'Credit Card' },
    { id: 'デビットカード', ja: 'デビットカード', en: 'Debit Card' },
    { id: 'QRコード決済', ja: 'QRコード決済', en: 'QR Code' },
    { id: '電子マネー', ja: '電子マネー', en: 'E-Money' },
    { id: '銀行振込', ja: '銀行振込', en: 'Bank Transfer' }
  ]
};

export default function Home() {
  const { currentLang: lang, t } = useLanguage();

  const [query, setQuery] = useState('');
  const [price, setPrice] = useState(3000);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [otherOptions, setOtherOptions] = useState<string[]>([]);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, array: string[], value: string) => {
    if (array.includes(value)) setter(array.filter(item => item !== value));
    else setter([...array, value]);
  };

  const clearFilters = () => {
    setQuery(''); setPrice(3000); setCuisines([]); setRestrictions([]); setPayments([]); setOtherOptions([]);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      
      let dbQuery = supabase.from('restaurants').select('*').eq('status', 'approved');

      if (query.trim()) {
        const tokens = query.replace(/　/g, ' ').split(/\s+/).filter(Boolean);
        tokens.forEach(token => {
          dbQuery = dbQuery.or(`title.ilike.%${token}%,description.ilike.%${token}%,address.ilike.%${token}%,takeout_menu.ilike.%${token}%`);
        });
      }
      
      if (price < 3000) dbQuery = dbQuery.lte('restaurant_price', price);
      
      if (cuisines.length > 0) dbQuery = dbQuery.overlaps('cuisine', cuisines);
      if (restrictions.length > 0) dbQuery = dbQuery.overlaps('food_restrictions', restrictions);
      if (payments.length > 0) dbQuery = dbQuery.overlaps('payment_methods', payments);
      if (otherOptions.length > 0) dbQuery = dbQuery.overlaps('other_options', otherOptions);

      const { data, error } = await dbQuery.order('created_at', { ascending: false });
      
      if (!error && data) setRestaurants(data);
      setLoading(false);
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [query, price, cuisines, restrictions, payments, otherOptions]);

  const hasActiveFilters = query || price !== 3000 || cuisines.length > 0 || restrictions.length > 0 || payments.length > 0 || otherOptions.length > 0;

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col gap-10 py-6">
      
      <div className="w-full max-w-3xl mx-auto mt-4 px-4">
        <h1 className="text-4xl md:text-5xl font-black text-center text-gray-900 mb-8 tracking-tight">Eatodakimasu</h1>
        <div className="relative shadow-lg rounded-2xl group bg-white">
          <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 text-2xl">🔍</span>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder', 'レストラン名、メニュー、エリアで検索')} 
            className="w-full pl-16 pr-12 py-5 bg-transparent border-2 border-transparent rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition text-lg font-bold text-gray-800"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row-reverse gap-8 px-4">
        
        <aside className="w-full lg:w-[300px] flex-shrink-0">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 sticky top-24">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900">{t('filter_title', 'フィルター')}</h2>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs font-bold text-orange-600 px-3 py-1.5 bg-orange-50 rounded-lg">
                  {t('btn_clear_filters', 'リセット')}
                </button>
              )}
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-xs font-bold text-gray-400 uppercase">{t('filter_budget', '予算')}</label>
                <span className="text-orange-600 font-black text-sm bg-orange-50 px-2 py-1 rounded-md">
                  {price === 3000 ? t('no_limit', '制限なし') : `¥${price} ${t('below', '以下')}`}
                </span>
              </div>
              <input type="range" min="500" max="3000" step="100" value={price} onChange={(e) => setPrice(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg accent-orange-600" />
            </div>

            {[
              { label: t('filter_cuisine', 'ジャンル'), state: cuisines, setter: setCuisines, options: FILTER_OPTIONS.cuisines },
              { label: t('filter_dietary', '食事制限'), state: restrictions, setter: setRestrictions, options: FILTER_OPTIONS.restrictions },
              { label: t('filter_payment', '決済方法'), state: payments, setter: setPayments, options: FILTER_OPTIONS.payments }
            ].map((group, idx) => (
              <div key={idx} className="mb-8">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{group.label}</label>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => (
                    <button 
                      key={opt.id} onClick={() => toggleArrayItem(group.setter, group.state, opt.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${group.state.includes(opt.id) ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {lang === 'en' ? opt.en : opt.ja}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_other', 'オプション')}</label>
              <label className="flex items-center cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                <input type="checkbox" checked={otherOptions.includes('スタンプラリー参加')} onChange={() => toggleArrayItem(setOtherOptions, otherOptions, 'スタンプラリー参加')} className="h-5 w-5 text-orange-600 rounded border-gray-300" />
                <span className="ml-3 text-sm font-bold text-gray-800">{t('stamp_rally', 'スタンプラリー参加')}</span>
              </label>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('label_search_results', '検索結果')}</h2>
            <div className="flex items-center gap-3">
              {loading && <span className="text-orange-500 font-bold text-sm animate-pulse">{t('searching', '検索中...')}</span>}
              <span className="text-gray-500 font-bold text-sm bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">
                {restaurants.length} {t('label_places', '店舗')}
              </span>
            </div>
          </div>

          <div className={`transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
            {restaurants.length === 0 && !loading ? (
              <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-200 px-6">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-2xl text-gray-800 font-black mb-2">{t('label_no_results', '条件に一致するレストランが見つかりません。')}</p>
                <p className="text-gray-500 font-medium text-sm mb-6">{t('not_found_desc', 'フィルターを変更するか、検索キーワードを調整してください。')}</p>
                <button onClick={clearFilters} className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl">{t('btn_clear_filters', 'すべてクリア')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {restaurants.map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}