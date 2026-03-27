'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RestaurantCard from '@/components/RestaurantCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { isOpenNow } from '@/lib/timeUtils'; 

export default function Home() {
  const { currentLang, t } = useLanguage();

  const [query, setQuery] = useState('');
  const [price, setPrice] = useState(3000);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [otherOptions, setOtherOptions] = useState<string[]>([]);
  const [openNowOnly, setOpenNowOnly] = useState(false); 

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ MOBILE DRAWER STATE
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

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

  // Lock background scroll when mobile modal is open
  useEffect(() => {
    if (isMobileFilterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [isMobileFilterOpen]);

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, array: string[], value: string) => {
    if (array.includes(value)) setter(array.filter(item => item !== value));
    else setter([...array, value]);
  };

  const clearFilters = () => {
    setQuery(''); setPrice(3000); setCuisines([]); setRestrictions([]); setPayments([]); setOtherOptions([]);
    setOpenNowOnly(false);
    setUserLocation(null);
    setGeoError('');
  };

  const toggleLocation = () => {
    if (userLocation) {
      setUserLocation(null);
      setGeoError('');
      return;
    }

    if (!navigator.geolocation) {
      setGeoError(t('geo_not_supported', 'お使いのブラウザは位置情報に対応していません。'));
      return;
    }

    setIsLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        setGeoError(t('geo_error', '位置情報を取得できませんでした。許可設定をご確認ください。'));
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
          if (e.is_constant) return true;
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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!hasMore && page !== 0) return;
      setLoading(true);

      let dbQuery = supabase.from('restaurants').select('*', { count: 'exact' }).eq('status', 'approved');

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

      if (userLocation) {
        const { data, error } = await dbQuery.limit(1000);
        if (!error && data) {
          let processed = data
            .filter(r => r.lat && r.lng)
            .map(r => ({
              ...r,
              dist_meters: calculateDistance(userLocation.lat, userLocation.lng, r.lat, r.lng)
            }))
            .sort((a, b) => a.dist_meters - b.dist_meters);

          if (openNowOnly) {
            processed = processed.filter(r => isOpenNow(r.operating_hours));
          }
          
          setRestaurants(processed);
          setTotalCount(processed.length);
          setHasMore(false);
        }
      } else {
        dbQuery = dbQuery.order('created_at', { ascending: false });
        const from = page * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, error, count } = await dbQuery.range(from, to);

        if (!error && data) {
          let processed = data;
          if (openNowOnly) {
            processed = processed.filter(r => isOpenNow(r.operating_hours));
          }

          if (page === 0) {
            setRestaurants(processed);
            setTotalCount(count || 0);
          } else {
            setRestaurants(prev => [...prev, ...processed]);
          }
          if (data.length < ITEMS_PER_PAGE) setHasMore(false);
        }
      }
      setLoading(false);
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [query, price, cuisines, restrictions, payments, otherOptions, page, userLocation, openNowOnly]);

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || userLocation) return; 
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore, userLocation]);

  const hasActiveFilters = query || price !== 3000 || cuisines.length > 0 || restrictions.length > 0 || payments.length > 0 || otherOptions.length > 0 || userLocation !== null || openNowOnly;

  const dbCuisines = masterFilters.filter(f => f.type === 'cuisine');
  const dbRestrictions = masterFilters.filter(f => f.type === 'restriction');
  const dbPayments = masterFilters.filter(f => f.type === 'payment');

  const getTranslatedName = (item: any) => {
    if (currentLang === 'ja') return item.name;
    const translation = item.translations?.[currentLang];
    if (!translation) return item.name;
    if (typeof translation === 'string') return translation; 
    if (typeof translation === 'object' && translation.name) return translation.name; 
    return item.name;
  };

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-10 py-6">
      
      {/* HEADER & SEARCH AREA */}
      <div className="w-full max-w-3xl mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-black text-center text-gray-900 mb-6 md:mb-8 tracking-tight">Eatodakimasu</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative shadow-lg rounded-2xl group bg-white flex-1">
            <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl md:text-2xl">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder', 'レストラン名、メニュー、エリアで検索')}
              className="w-full pl-14 md:pl-16 pr-12 py-4 md:py-5 bg-transparent border-2 border-transparent rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition text-base md:text-lg font-bold text-gray-800"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-4 md:right-5 top-1/2 transform -translate-y-1/2 text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
            )}
          </div>
          
          <button 
            onClick={toggleLocation}
            disabled={isLocating}
            className={`shadow-lg rounded-2xl px-6 py-4 md:py-5 font-black text-sm flex items-center justify-center gap-2 transition whitespace-nowrap ${userLocation ? 'bg-orange-600 text-white border-2 border-orange-600' : 'bg-white text-gray-700 border-2 border-transparent hover:border-gray-200'} disabled:opacity-50 disabled:cursor-wait`}
          >
            {isLocating ? (
              <span className="animate-pulse">📍 {t('geo_loading', '取得中...')}</span>
            ) : userLocation ? (
              <span>📍 {t('geo_active', '近い順で表示中 (解除)')}</span>
            ) : (
              <span>📍 {t('geo_button', '現在地から探す')}</span>
            )}
          </button>
        </div>
        
        {geoError && (
          <p className="text-red-500 text-sm font-bold mt-3 text-center">{geoError}</p>
        )}

        {/* ✅ MOBILE FILTER TOGGLE BUTTON */}
        <div className="lg:hidden mt-4">
          <button 
            onClick={() => setIsMobileFilterOpen(true)}
            className="w-full bg-white border-2 border-gray-200 text-gray-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm active:bg-gray-50 transition"
          >
            <span className="text-lg">⚙️</span> {t('filter_title', 'フィルター設定')}
            {hasActiveFilters && (
              <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-1 uppercase tracking-widest shadow-sm">
                Active
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row-reverse gap-8 px-4">
        
        {/* ✅ DARK OVERLAY FOR MOBILE MODAL */}
        {isMobileFilterOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-[100] lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileFilterOpen(false)}
          />
        )}

        {/* ✅ THE ASIDE: Desktop Sidebar OR Mobile Drawer */}
        <aside className={`
          fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto
          lg:relative lg:block lg:z-0 lg:w-[300px] lg:flex-shrink-0 lg:transform-none lg:shadow-none lg:bg-transparent lg:overflow-visible lg:h-auto
          ${isMobileFilterOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          <div className="bg-white p-6 lg:rounded-3xl lg:shadow-sm lg:border lg:border-gray-200 lg:sticky lg:top-24 min-h-full lg:min-h-0 flex flex-col">
            
            {/* MOBILE HEADER */}
            <div className="flex justify-between items-center mb-6 lg:hidden border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-black text-gray-900">{t('filter_title', 'フィルター')}</h2>
              <button onClick={() => setIsMobileFilterOpen(false)} className="text-gray-400 hover:text-gray-900 bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold">✕</button>
            </div>

            {/* DESKTOP HEADER */}
            <div className="hidden lg:flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900">{t('filter_title', 'フィルター')}</h2>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs font-bold text-orange-600 px-3 py-1.5 bg-orange-50 rounded-lg transition hover:bg-orange-100">
                  {t('btn_clear_filters', 'リセット')}
                </button>
              )}
            </div>

            {/* MOBILE CLEAR FILTERS BUTTON */}
            {hasActiveFilters && (
               <button onClick={clearFilters} className="lg:hidden mb-6 w-full text-sm font-bold text-orange-600 py-3 bg-orange-50 rounded-xl border border-orange-100 active:bg-orange-100 transition">
                 {t('btn_clear_filters', '条件をリセットする')}
               </button>
            )}

            <div className="mb-8">
              <label className="flex items-center cursor-pointer p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition">
                <input 
                  type="checkbox" 
                  checked={openNowOnly} 
                  onChange={(e) => setOpenNowOnly(e.target.checked)} 
                  className="h-6 w-6 lg:h-5 lg:w-5 accent-orange-600 cursor-pointer" 
                />
                <span className="ml-4 lg:ml-3 font-black text-gray-800 text-base lg:text-sm">{t('filter_open_now', '🕒 営業中のみ')}</span>
              </label>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-xs font-bold text-gray-400 uppercase">{t('filter_budget', '予算')}</label>
                <span className="text-orange-600 font-black text-sm bg-orange-50 px-2 py-1 rounded-md">
                  {price === 3000 ? t('price_no_limit', '制限なし') : t('price_under_amount', '¥{{price}} 以下', { price: price })}
                </span>
              </div>
              <input type="range" min="500" max="3000" step="100" value={price} onChange={(e) => setPrice(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg accent-orange-600 cursor-pointer" />
            </div>

            {[
              { label: t('filter_cuisine', 'ジャンル'), state: cuisines, setter: setCuisines, options: dbCuisines },
              { label: t('filter_dietary', '食事制限'), state: restrictions, setter: setRestrictions, options: dbRestrictions },
              { label: t('filter_payment', '決済方法'), state: payments, setter: setPayments, options: dbPayments }
            ].map((group, idx) => (
              <div key={idx} className="mb-8">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{group.label}</label>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => (
                    <button
                      key={opt.id} 
                      onClick={() => toggleArrayItem(group.setter, group.state, opt.name)}
                      className={`px-3 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs font-bold border transition ${group.state.includes(opt.name) ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {getTranslatedName(opt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {activeEvents.length > 0 && (
              <div className="mb-12 lg:mb-2">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_events', 'イベント・その他')}</label>
                <div className="flex flex-col gap-2">
                  {activeEvents.map((event) => (
                    <label key={event.id} className="flex items-center cursor-pointer p-4 lg:p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                      <input
                        type="checkbox"
                        checked={otherOptions.includes(event.name)}
                        onChange={() => toggleArrayItem(setOtherOptions, otherOptions, event.name)}
                        className="h-6 w-6 lg:h-5 lg:w-5 text-orange-600 rounded border-gray-300 cursor-pointer"
                      />
                      <span className="ml-4 lg:ml-3 text-base lg:text-sm font-bold text-gray-800">{getTranslatedName(event)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* MOBILE APPLY BUTTON (Sticks to bottom of drawer) */}
            <div className="mt-auto pt-4 pb-6 lg:hidden sticky bottom-0 bg-white border-t border-gray-100 z-10">
               <button 
                 onClick={() => setIsMobileFilterOpen(false)} 
                 className="w-full bg-gray-900 text-white font-black text-lg py-4 rounded-2xl shadow-xl active:scale-95 transition-transform"
               >
                 {t('btn_apply_filters', '結果を表示する')}
               </button>
            </div>
            
          </div>
        </aside>

        {/* RESTAURANT GRID */}
        <main className="flex-1">
          <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('label_search_results', '検索結果')}</h2>
            <div className="flex items-center gap-3">
              {loading && page === 0 && <span className="text-orange-500 font-bold text-sm animate-pulse">{t('searching', '検索中...')}</span>}
              <span className="text-gray-500 font-bold text-sm bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">
                {t('label_places_count', '{{count}} 店舗', { count: totalCount })}
              </span>
            </div>
          </div>

          <div className={`transition-opacity duration-300 ${loading && page === 0 ? 'opacity-40' : 'opacity-100'}`}>
            {restaurants.length === 0 && !loading ? (
              <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-200 px-6">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-2xl text-gray-800 font-black mb-2">{t('label_no_results', '条件に一致するレストランが見つかりません。')}</p>
                <p className="text-gray-500 font-medium text-sm mb-6">{t('not_found_desc', 'フィルターを変更するか、検索キーワードを調整してください。')}</p>
                <button onClick={clearFilters} className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl">{t('btn_clear_filters', 'すべてクリア')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {restaurants.map((restaurant, index) => {
                  if (restaurants.length === index + 1) {
                    return (
                      <div ref={lastElementRef} key={restaurant.id}>
                        <RestaurantCard restaurant={restaurant} activeEvents={activeEvents} userLocation={userLocation} />
                      </div>
                    );
                  }
                  return <RestaurantCard key={restaurant.id} restaurant={restaurant} activeEvents={activeEvents} userLocation={userLocation} />;
                })}
              </div>
            )}
            
            {loading && page > 0 && (
              <div className="w-full text-center py-8">
                <span className="text-orange-500 font-bold text-sm animate-pulse">Loading more...</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}