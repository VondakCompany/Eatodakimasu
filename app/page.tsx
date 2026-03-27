'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RestaurantCard from '@/components/RestaurantCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { isOpenNow } from '@/lib/timeUtils'; // ✅ Import utility

export default function Home() {
  const { currentLang, t } = useLanguage();

  const [query, setQuery] = useState('');
  const [price, setPrice] = useState(3000);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [otherOptions, setOtherOptions] = useState<string[]>([]);
  const [openNowOnly, setOpenNowOnly] = useState(false); // ✅ New state

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- INFINITE SCROLL & COUNT STATE ---
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 50;
  const observer = useRef<IntersectionObserver | null>(null);

  // --- GEOLOCATION STATE ---
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [geoError, setGeoError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, array: string[], value: string) => {
    if (array.includes(value)) setter(array.filter(item => item !== value));
    else setter([...array, value]);
  };

  const clearFilters = () => {
    setQuery(''); setPrice(3000); setCuisines([]); setRestrictions([]); setPayments([]); setOtherOptions([]);
    setOpenNowOnly(false); // ✅ Reset
    setUserLocation(null);
    setGeoError('');
  };

  const toggleLocation = () => {
    if (userLocation) { setUserLocation(null); setGeoError(''); return; }
    if (!navigator.geolocation) {
      setGeoError(t('geo_not_supported', 'お使いのブラウザは位置情報に対応していません。'));
      return;
    }
    setIsLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsLocating(false);
      },
      (error) => {
        setGeoError(t('geo_error', '位置情報を取得できませんでした。'));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const fetchFiltersAndEvents = async () => {
      const { data: filtersData } = await supabase.from('filter_options').select('*').order('name');
      if (filtersData) setMasterFilters(filtersData);
      const { data: eventsData } = await supabase.from('custom_categories').select('*').order('created_at');
      if (eventsData) {
        const today = new Date().toISOString().split('T')[0]; 
        const validEvents = eventsData.filter(e => {
          if (e.is_constant) return true; // ✅ Bypasses date logic for constant events

          const start = e.start_date ? e.start_date.split('T')[0] : null;
          const end = e.end_date ? e.end_date.split('T')[0] : null;
          if (!start && !end) return true;
          if (start && end) return today >= start && today <= end;
          if (start) return today >= start;
          if (end) return today <= end;
          return true;
        });
        setActiveEvents(validEvents);
      }
    };
    fetchFiltersAndEvents();
  }, []);

  useEffect(() => {
    setPage(0);
    setRestaurants([]);
    setHasMore(true);
  }, [query, price, cuisines, restrictions, payments, otherOptions, userLocation, openNowOnly]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!hasMore && page !== 0) return;
      setLoading(true);

      let dbQuery;
      if (userLocation) {
        dbQuery = supabase.rpc('nearby_restaurants', { user_lat: userLocation.lat, user_lng: userLocation.lng }, { count: 'exact' });
      } else {
        dbQuery = supabase.from('restaurants').select('*', { count: 'exact' }).eq('status', 'approved');
      }

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

      if (!userLocation) dbQuery = dbQuery.order('created_at', { ascending: false });

      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const { data, error, count } = await dbQuery.range(from, to);

      if (!error && data) {
        // ✅ Frontend filter for "Open Now"
        let processedData = data;
        if (openNowOnly) {
          processedData = data.filter(r => isOpenNow(r.operating_hours));
        }

        if (page === 0) {
          setRestaurants(processedData);
          setTotalCount(count || 0);
        } else {
          setRestaurants(prev => [...prev, ...processedData]);
        }
        if (data.length < ITEMS_PER_PAGE) setHasMore(false);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [query, price, cuisines, restrictions, payments, otherOptions, page, userLocation, openNowOnly]);

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1);
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const hasActiveFilters = query || price !== 3000 || cuisines.length > 0 || restrictions.length > 0 || payments.length > 0 || otherOptions.length > 0 || userLocation !== null || openNowOnly;

  const getTranslatedName = (item: any) => {
    if (currentLang === 'ja') return item.name;
    const translation = item.translations?.[currentLang];
    if (!translation) return item.name;
    if (typeof translation === 'string') return translation; 
    if (typeof translation === 'object' && translation.name) return translation.name; 
    return item.name;
  };

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col gap-10 py-6">
      <div className="w-full max-w-3xl mx-auto mt-4 px-4">
        <h1 className="text-4xl md:text-5xl font-black text-center text-gray-900 mb-8 tracking-tight">Eatodakimasu</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative shadow-lg rounded-2xl group bg-white flex-1">
            <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 text-2xl">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder', '店舗名、エリアで検索')}
              className="w-full pl-16 pr-12 py-5 bg-transparent border-2 border-transparent rounded-2xl focus:border-orange-500 outline-none transition text-lg font-bold text-gray-800"
            />
            {query && <button onClick={() => setQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">✕</button>}
          </div>
          
          <button 
            onClick={toggleLocation}
            disabled={isLocating}
            className={`shadow-lg rounded-2xl px-6 py-5 font-black text-sm flex items-center justify-center gap-2 transition whitespace-nowrap ${userLocation ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 hover:border-gray-200 border-2 border-transparent'}`}
          >
            {isLocating ? t('geo_loading', '取得中...') : userLocation ? t('geo_active', '近い順 (解除)') : t('geo_button', '現在地から探す')}
          </button>
        </div>
        {geoError && <p className="text-red-500 text-sm font-bold mt-3 text-center">{geoError}</p>}
      </div>

      <div className="flex flex-col lg:flex-row-reverse gap-8 px-4">
        <aside className="w-full lg:w-[300px] flex-shrink-0">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 sticky top-24">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900">{t('filter_title', 'フィルター')}</h2>
              {hasActiveFilters && <button onClick={clearFilters} className="text-xs font-bold text-orange-600 px-3 py-1.5 bg-orange-50 rounded-lg">{t('btn_clear_filters', 'リセット')}</button>}
            </div>

            {/* ✅ OPEN NOW TOGGLE */}
            <div className="mb-8">
              <label className="flex items-center cursor-pointer p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition">
                <input 
                  type="checkbox" 
                  checked={openNowOnly} 
                  onChange={(e) => setOpenNowOnly(e.target.checked)} 
                  className="h-5 w-5 accent-orange-600" 
                />
                <span className="ml-3 font-black text-gray-800 text-sm">{t('filter_open_now', '🕒 営業中のみ')}</span>
              </label>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-xs font-bold text-gray-400 uppercase">{t('filter_budget', '予算')}</label>
                <span className="text-orange-600 font-black text-sm bg-orange-50 px-2 py-1 rounded-md">{price === 3000 ? t('price_no_limit', '制限なし') : t('price_under_amount', '¥{{price}} 以下', { price })}</span>
              </div>
              <input type="range" min="500" max="3000" step="100" value={price} onChange={(e) => setPrice(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg accent-orange-600" />
            </div>

            {[
              { label: t('filter_cuisine', 'ジャンル'), state: cuisines, setter: setCuisines, options: masterFilters.filter(f => f.type === 'cuisine') },
              { label: t('filter_dietary', '食事制限'), state: restrictions, setter: setRestrictions, options: masterFilters.filter(f => f.type === 'restriction') },
              { label: t('filter_payment', '決済方法'), state: payments, setter: setPayments, options: masterFilters.filter(f => f.type === 'payment') }
            ].map((group, idx) => (
              <div key={idx} className="mb-8">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{group.label}</label>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => (
                    <button key={opt.id} onClick={() => toggleArrayItem(group.setter, group.state, opt.name)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${group.state.includes(opt.name) ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'}`}>{getTranslatedName(opt)}</button>
                  ))}
                </div>
              </div>
            ))}

            {activeEvents.length > 0 && (
              <div className="mb-2">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_events', 'イベント・その他')}</label>
                <div className="flex flex-col gap-2">
                  {activeEvents.map((event) => (
                    <label key={event.id} className="flex items-center cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                      <input type="checkbox" checked={otherOptions.includes(event.name)} onChange={() => toggleArrayItem(setOtherOptions, otherOptions, event.name)} className="h-5 w-5 accent-orange-600" />
                      <span className="ml-3 text-sm font-bold text-gray-800">{getTranslatedName(event)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1">
          <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('label_search_results', '検索結果')}</h2>
            <div className="flex items-center gap-3">
              {loading && page === 0 && <span className="text-orange-500 font-bold text-sm animate-pulse">{t('searching', '検索中...')}</span>}
              <span className="text-gray-500 font-bold text-sm bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">{t('label_places_count', '{{count}} 店舗', { count: totalCount })}</span>
            </div>
          </div>

          <div className={`transition-opacity duration-300 ${loading && page === 0 ? 'opacity-40' : 'opacity-100'}`}>
            {restaurants.length === 0 && !loading ? (
              <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-200 px-6">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-2xl text-gray-800 font-black mb-2">{t('label_no_results', '条件に一致する店舗が見つかりません。')}</p>
                <button onClick={clearFilters} className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl">{t('btn_clear_filters', 'すべてクリア')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {restaurants.map((restaurant, index) => (
                  <div ref={restaurants.length === index + 1 ? lastElementRef : null} key={restaurant.id}>
                    <RestaurantCard restaurant={restaurant} activeEvents={activeEvents} />
                  </div>
                ))}
              </div>
            )}
            {loading && page > 0 && <div className="w-full text-center py-8 animate-pulse text-orange-500 font-bold">Loading more...</div>}
          </div>
        </main>
      </div>
    </div>
  );
}