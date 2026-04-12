'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import RestaurantCard from '@/components/RestaurantCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { isOpenNow } from '@/lib/timeUtils'; 

const CAMPUSES = {
  waseda: { name: '早稲田', lat: 35.7089, lng: 139.7202 },
  toyama: { name: '戸山', lat: 35.7056, lng: 139.7153 },
  nishiwaseda: { name: '西早稲田', lat: 35.7058, lng: 139.7067 },
  tokorozawa: { name: '所沢', lat: 35.7876, lng: 139.4002 },
};

export default function Home() {
  const { currentLang, t } = useLanguage();

  if (process.env.NODE_ENV === 'development') {
    t('ad_sticky_title', 'Special Promo');
    t('ad_sponsored_label', 'Sponsored');
    t('ad_open_btn', 'Open');
    t('ad_featured_title', 'Featured Content');
    t('ad_featured_desc', 'Tap to explore');
    t('ad_label', 'Ad');
    t('ad_partner_title', 'Featured Partner');
    t('ad_view_details', 'Tap to view details');
    t('loading_more', 'Loading more...');
    t('filter_budget', '予算');
    t('filter_cuisine', 'ジャンル');
    t('filter_dietary', '食事制限');
    t('filter_payment', '決済方法');
    t('filter_events', 'イベント・その他');
    t('filter_distance', '距離 (徒歩)');
    t('dist_5', '5分以内');
    t('dist_10', '10分以内');
    t('dist_15', '15分以内');
    t('dist_require_origin', '距離で絞り込むには、キャンパスまたは現在地を選択してください。');
    t('filter_stay_time', '滞在時間');
    t('stay_15', '〜15分');
    t('stay_15_30', '15分〜30分');
    t('stay_30_60', '30分〜1時間');
    t('stay_60_plus', '1時間以上');
    t('filter_open_now', '営業中のみ');
    t('filter_takeout', 'テイクアウト可');
  }

  const [query, setQuery] = useState('');
  const [price, setPrice] = useState(3000);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [otherOptions, setOtherOptions] = useState<string[]>([]);
  
  const [openNowOnly, setOpenNowOnly] = useState(false); 
  const [takeoutOnly, setTakeoutOnly] = useState(false);
  
  const [campusSort, setCampusSort] = useState('');
  const [seatCapacity, setSeatCapacity] = useState('');
  const [maxWalkTime, setMaxWalkTime] = useState<number | ''>(''); 
  const [stayDuration, setStayDuration] = useState(''); 

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  
  const [ads, setAds] = useState<any[]>([]); 
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [isSlowData, setIsSlowData] = useState(false); // Slow Network Detection
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 50; 
  const observer = useRef<IntersectionObserver | null>(null);

  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [geoError, setGeoError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [isEditor, setIsEditor] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.location.search.includes('ad_editor=true') || window.self !== window.top) {
       setIsEditor(true);
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'AD_STUDIO_SYNC') {
         setAds(e.data.ads);
         setSelectedAdId(e.data.selectedAdId);
      }
    };
    window.addEventListener('message', handleMessage);

    if (isMobileFilterOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { 
      document.body.style.overflow = 'unset'; 
      window.removeEventListener('message', handleMessage);
    };
  }, [isMobileFilterOpen]);

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, array: string[], value: string) => {
    if (array.includes(value)) setter(array.filter(item => item !== value));
    else setter([...array, value]);
  };

  const clearFilters = () => {
    setQuery(''); setPrice(3000); setCuisines([]); setRestrictions([]); setPayments([]); setOtherOptions([]);
    setOpenNowOnly(false); setTakeoutOnly(false);
    setCampusSort(''); setSeatCapacity(''); setMaxWalkTime(''); setStayDuration('');
    setUserLocation(null); setGeoError('');
  };

  const toggleLocation = () => {
    if (userLocation) { setUserLocation(null); setGeoError(''); return; }
    if (!navigator.geolocation) { setGeoError(t('geo_not_supported', 'お使いのブラウザは位置情報に対応していません。')); return; }
    setIsLocating(true); setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => { setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setIsLocating(false); setCampusSort(''); },
      (error) => { console.error(error); setGeoError(t('geo_error', '位置情報を取得できませんでした。許可設定をご確認ください。')); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Resilient, non-blocking metadata fetch
  useEffect(() => {
    const fetchFiltersEventsAndAds = () => {
      Promise.allSettled([
        supabase.from('filter_options').select('*').order('name')
          .then(res => { if (res.data) setMasterFilters(res.data); }),
          
        supabase.from('custom_categories').select('*').order('created_at')
          .then(res => {
            if (res.data) {
              const today = new Date().toISOString().split('T')[0]; 
              const validEvents = res.data.filter(e => {
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
          }),
          
        supabase.from('ad_campaigns').select('*').eq('is_active', true).in('target_page', ['*', '/'])
          .then(res => { if (res.data && !isEditor) setAds(res.data); })
      ]);
    };
    fetchFiltersEventsAndAds();
  }, [isEditor]);

  useEffect(() => {
    setPage(0); setRestaurants([]); setHasMore(true);
  }, [query, price, cuisines, restrictions, payments, otherOptions, userLocation, openNowOnly, takeoutOnly, campusSort, seatCapacity, maxWalkTime, stayDuration]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180; 
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180; 
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c * 1.3; 
  };

  // Main debounced query with slow network detection
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!hasMore && page !== 0) return;
      
      setLoading(true);
      setIsSlowData(false);
      const slowTimer = setTimeout(() => setIsSlowData(true), 4000);

      let dbQuery = supabase.from('restaurants').select('*', { count: 'exact' }).eq('status', 'approved');

      if (query.trim()) {
        const tokens = query.replace(/　/g, ' ').split(/\s+/).filter(Boolean);
        tokens.forEach(token => { dbQuery = dbQuery.or(`title.ilike.%${token}%,description.ilike.%${token}%,address.ilike.%${token}%,takeout_menu.ilike.%${token}%`); });
      }
      if (price < 3000) dbQuery = dbQuery.lte('restaurant_price', price);
      if (cuisines.length > 0) dbQuery = dbQuery.overlaps('cuisine', cuisines);
      if (restrictions.length > 0) dbQuery = dbQuery.overlaps('food_restrictions', restrictions);
      if (payments.length > 0) dbQuery = dbQuery.overlaps('payment_methods', payments);
      if (otherOptions.length > 0) dbQuery = dbQuery.overlaps('other_options', otherOptions);
      if (takeoutOnly) dbQuery = dbQuery.eq('takeout_available', true);
      if (stayDuration) dbQuery = dbQuery.eq('avg_stay_time', stayDuration);

      const requiresClientProcessing = userLocation || campusSort || seatCapacity || openNowOnly || maxWalkTime;

      if (requiresClientProcessing) {
        const { data, error } = await dbQuery.limit(1000);
        if (!error && data) {
          let processed = data.map(r => {
            let dist_meters = undefined;
            let campus_dist_meters = undefined;
            let campus_name = undefined;

            if (r.lat && r.lng) {
              if (userLocation) {
                dist_meters = calculateDistance(userLocation.lat, userLocation.lng, r.lat, r.lng);
              }
              if (campusSort) {
                const target = CAMPUSES[campusSort as keyof typeof CAMPUSES];
                campus_dist_meters = calculateDistance(target.lat, target.lng, r.lat, r.lng);
                campus_name = target.name.split(' ')[0]; 
              }
            }
            return { ...r, dist_meters, campus_dist_meters, campus_name };
          });

          if (seatCapacity) {
            processed = processed.filter(r => {
              const rawSeats = (r.total_seats || '').toString();
              const seatNumber = parseInt(rawSeats.replace(/[^0-9]/g, ''), 10) || 0;
              if (seatCapacity === 'small' && (seatNumber < 1 || seatNumber > 10)) return false;
              if (seatCapacity === 'medium' && (seatNumber < 11 || seatNumber > 30)) return false;
              if (seatCapacity === 'large' && seatNumber < 31) return false;
              return true;
            });
          }

          if (openNowOnly) {
            processed = processed.filter(r => isOpenNow(r.operating_hours));
          }

          if (maxWalkTime) {
            processed = processed.filter(r => {
              const dist = campusSort ? r.campus_dist_meters : r.dist_meters;
              if (dist === undefined) return false;
              return dist <= (Number(maxWalkTime) * 80); 
            });
          }

          if (campusSort) {
            processed = processed.filter(r => r.campus_dist_meters !== undefined);
            processed.sort((a, b) => (a.campus_dist_meters || 0) - (b.campus_dist_meters || 0));
          } else if (userLocation) {
            processed = processed.filter(r => r.dist_meters !== undefined);
            processed.sort((a, b) => (a.dist_meters || 0) - (b.dist_meters || 0));
          }

          setRestaurants(processed); setTotalCount(processed.length); setHasMore(false);
        }
      } else {
        dbQuery = dbQuery.order('created_at', { ascending: false });
        const from = page * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, error, count } = await dbQuery.range(from, to);

        if (!error && data) {
          if (page === 0) { setRestaurants(data); setTotalCount(count || 0); } 
          else { setRestaurants(prev => [...prev, ...data]); }
          if (data.length < ITEMS_PER_PAGE) setHasMore(false);
        }
      }
      
      setLoading(false);
      clearTimeout(slowTimer);
    }, 250);
    
    return () => clearTimeout(delayDebounceFn);
  }, [query, price, cuisines, restrictions, payments, otherOptions, page, userLocation, openNowOnly, takeoutOnly, campusSort, seatCapacity, maxWalkTime, stayDuration]);

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || userLocation || campusSort || seatCapacity || openNowOnly || maxWalkTime || stayDuration) return; 
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => { if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1); });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, userLocation, campusSort, seatCapacity, openNowOnly, maxWalkTime, stayDuration]);

  const hasActiveFilters = query || price !== 3000 || cuisines.length > 0 || restrictions.length > 0 || payments.length > 0 || otherOptions.length > 0 || userLocation !== null || openNowOnly || takeoutOnly || campusSort !== '' || seatCapacity !== '' || maxWalkTime !== '' || stayDuration !== '';

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

  const topAds = ads.filter(a => a.mobile_fallback === 'top');
  const bottomAds = ads.filter(a => a.mobile_fallback === 'bottom');

  return (
    <div className="w-full relative">
      
      {mounted && !isEditor && createPortal(
        <div className="hidden lg:block absolute top-0 left-1/2 transform -translate-x-1/2 w-[1600px] h-0 z-40 pointer-events-none">
          {ads.map(ad => (
            <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" className="absolute pointer-events-auto rounded-[1.5rem] overflow-hidden transition hover:opacity-90 bg-gray-50" style={{ left: ad.x, top: ad.y, width: ad.w, height: ad.h }}>
              <img src={ad.image_url} className="w-full h-full object-cover" alt="Advertisement" />
            </a>
          ))}
        </div>,
        document.body
      )}

      {mounted && createPortal(
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)]">
          {ads.filter(a => a.mobile_fallback === 'sticky').map(ad => (
            <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditor) { e.preventDefault(); window.parent.postMessage({ type: 'AD_STUDIO_SELECT', id: ad.id }, '*'); } }} className={`w-full h-24 bg-white/90 backdrop-blur-md flex items-center px-5 gap-4 border-t pointer-events-auto transition-all ${selectedAdId === ad.id ? 'border-t-indigo-500 border-t-[4px] -translate-y-2' : 'border-gray-200'}`}>
              <img src={ad.image_url} className="w-14 h-14 rounded-2xl object-cover shadow-sm" alt="Sponsored" />
              <div className="flex flex-col flex-1 truncate">
                <span className="font-black text-sm text-gray-900">{t('ad_sticky_title', 'Special Promo')}</span>
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{t('ad_sponsored_label', 'Sponsored')}</span>
              </div>
              <span className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-xs font-black shadow-sm">{t('ad_open_btn', 'Open')}</span>
            </a>
          ))}
        </div>,
        document.body
      )}

      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-10 py-6 relative z-10 pb-[env(safe-area-inset-bottom)]">
        
        {topAds.length > 0 && (
          <div className="w-full max-w-3xl mx-auto px-4 mt-2">
            {topAds.map(ad => (
              <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditor) { e.preventDefault(); window.parent.postMessage({ type: 'AD_STUDIO_SELECT', id: ad.id }, '*'); } }} className={`lg:hidden block w-full bg-white rounded-[2rem] shadow-sm border overflow-hidden mb-6 group transition-all duration-300 ${selectedAdId === ad.id ? 'ring-4 ring-indigo-500 border-indigo-500 scale-[1.02]' : 'border-gray-200 hover:shadow-xl'}`}>
                <div className="relative h-48 w-full overflow-hidden">
                  <img src={ad.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Sponsored" />
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">{t('ad_sponsored_label', 'Sponsored')}</div>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-black text-lg text-gray-900">{t('ad_featured_title', 'Featured Content')}</span>
                    <span className="text-xs font-bold text-gray-400 mt-0.5">{t('ad_featured_desc', 'Tap to explore')}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">→</div>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-black text-center text-gray-900 mb-6 md:mb-8 tracking-tight">Eatodakimasu</h1>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative shadow-lg rounded-2xl group bg-white flex-1">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder', 'レストラン名、メニュー、エリアで検索')} className="w-full pl-6 md:pl-8 pr-12 py-4 md:py-5 bg-transparent border-2 border-transparent rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition text-base md:text-lg font-bold text-gray-800" />
              {query && <button onClick={() => setQuery('')} className="absolute right-4 md:right-5 top-1/2 transform -translate-y-1/2 text-gray-400 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">✕</button>}
            </div>
            
            <button onClick={toggleLocation} disabled={isLocating} className={`shadow-lg rounded-2xl px-6 py-4 md:py-5 font-black text-sm flex items-center justify-center gap-2 transition whitespace-nowrap ${userLocation && !campusSort ? 'bg-orange-600 text-white border-2 border-orange-600' : 'bg-white text-gray-700 border-2 border-transparent hover:border-gray-200'} disabled:opacity-50 disabled:cursor-wait`}>
              {isLocating ? <span className="animate-pulse">{t('geo_loading', '取得中...')}</span> : (userLocation && !campusSort) ? <span>{t('geo_active', '近い順で表示中 (解除)')}</span> : <span>{t('geo_button', '現在地から探す')}</span>}
            </button>
          </div>
          
          {geoError && <p className="text-red-500 text-sm font-bold mt-3 text-center">{geoError}</p>}

          <div className="lg:hidden mt-4">
            <button onClick={() => setIsMobileFilterOpen(true)} className="w-full bg-white border-2 border-gray-200 text-gray-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm active:bg-gray-50 transition">
              <span>{t('filter_title', 'フィルター設定')}</span>
              {hasActiveFilters && <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-1 uppercase tracking-widest shadow-sm">Active</span>}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row-reverse gap-8 px-4">
          
          {isMobileFilterOpen && <div className="fixed inset-0 bg-black/60 z-[100] lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileFilterOpen(false)} />}

          <aside className={`fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col lg:relative lg:block lg:z-0 lg:w-[300px] lg:flex-shrink-0 lg:transform-none lg:shadow-none lg:bg-transparent lg:h-auto ${isMobileFilterOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
            <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100 lg:hidden shrink-0 pt-[max(1.5rem,env(safe-area-inset-top))]">
              <h2 className="text-2xl font-black text-gray-900">{t('filter_title', 'フィルター')}</h2>
              <button onClick={() => setIsMobileFilterOpen(false)} className="text-gray-400 hover:text-gray-900 bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-0 lg:overflow-visible">
              <div className="bg-white lg:p-6 lg:rounded-3xl lg:shadow-sm lg:border lg:border-gray-200 lg:sticky lg:top-24 flex flex-col">
                <div className="hidden lg:flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h2 className="text-lg font-black text-gray-900">{t('filter_title', 'フィルター')}</h2>
                  {hasActiveFilters && <button onClick={clearFilters} className="text-xs font-bold text-orange-600 px-3 py-1.5 bg-orange-50 rounded-lg transition hover:bg-orange-100">{t('btn_clear_filters', 'リセット')}</button>}
                </div>
                {hasActiveFilters && (
                   <button onClick={clearFilters} className="lg:hidden mb-6 w-full text-sm font-bold text-orange-600 py-3 bg-orange-50 rounded-xl border border-orange-100 active:bg-orange-100 transition">{t('btn_clear_filters', '条件をリセットする')}</button>
                )}
                
                <div className="mb-6">
                  <label className="flex items-center cursor-pointer p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition">
                    <input type="checkbox" checked={openNowOnly} onChange={(e) => setOpenNowOnly(e.target.checked)} className="h-6 w-6 lg:h-5 lg:w-5 accent-orange-600 cursor-pointer" />
                    <span className="ml-4 lg:ml-3 font-black text-gray-800 text-base lg:text-sm">{t('filter_open_now', '営業中のみ')}</span>
                  </label>
                </div>

                <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_campus', 'キャンパス')}</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CAMPUSES).map(([key, campus]) => (
                      <button
                        key={key}
                        onClick={() => { setCampusSort(campusSort === key ? '' : key); setUserLocation(null); setGeoError(''); setMaxWalkTime(''); }}
                        className={`px-3 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs font-bold border transition ${campusSort === key ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t(`tag_campus_${key}`, campus.name)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_distance', '距離 (徒歩)')}</label>
                  {(!campusSort && !userLocation) ? (
                    <div className="text-xs font-bold text-orange-600 bg-orange-50 p-3 rounded-xl border border-orange-100 leading-relaxed">
                      {t('dist_require_origin', '距離で絞り込むには、キャンパスまたは現在地を選択してください。')}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 5, label: '5分以内' },
                        { id: 10, label: '10分以内' },
                        { id: 15, label: '15分以内' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setMaxWalkTime(maxWalkTime === opt.id ? '' : opt.id)}
                          className={`px-3 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs font-bold border transition ${maxWalkTime === opt.id ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                          {t(`dist_${opt.id}`, opt.label)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_seats', '席数')}</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'small', label: '1-10 席' },
                      { id: 'medium', label: '11-30 席' },
                      { id: 'large', label: '31 席以上' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSeatCapacity(seatCapacity === opt.id ? '' : opt.id)}
                        className={`px-3 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs font-bold border transition ${seatCapacity === opt.id ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t(`tag_seats_${opt.id}`, opt.label)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase">{t('filter_stay_time', '平均滞在時間')}</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: '~15分', label: t('stay_15', '〜15分') },
                      { id: '15分~30分', label: t('stay_15_30', '15分〜30分') },
                      { id: '30分~1時間', label: t('stay_30_60', '30分〜1時間') },
                      { id: '1時間以上', label: t('stay_60_plus', '1時間以上') }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setStayDuration(stayDuration === opt.id ? '' : opt.id)}
                        className={`px-3 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs font-bold border transition ${stayDuration === opt.id ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-xs font-bold text-gray-400 uppercase">{t('filter_budget', '予算')}</label>
                    <span className="text-orange-600 font-black text-sm bg-orange-50 px-2 py-1 rounded-md">{price === 3000 ? t('price_no_limit', '制限なし') : t('price_under_amount', '¥{{price}} 以下', { price: price })}</span>
                  </div>
                  <input type="range" min="500" max="3000" step="100" value={price} onChange={(e) => setPrice(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg accent-orange-600 cursor-pointer" />
                </div>

                <div className="mb-8">
                  <label className="flex items-center cursor-pointer p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition">
                    <input type="checkbox" checked={takeoutOnly} onChange={(e) => setTakeoutOnly(e.target.checked)} className="h-6 w-6 lg:h-5 lg:w-5 accent-orange-600 cursor-pointer" />
                    <span className="ml-4 lg:ml-3 font-black text-gray-800 text-base lg:text-sm">{t('filter_takeout', 'テイクアウト可')}</span>
                  </label>
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
                        <button key={opt.id} onClick={() => toggleArrayItem(group.setter, group.state, opt.name)} className={`px-3 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs font-bold border transition ${group.state.includes(opt.name) ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
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
                          <input type="checkbox" checked={otherOptions.includes(event.name)} onChange={() => toggleArrayItem(setOtherOptions, otherOptions, event.name)} className="h-6 w-6 lg:h-5 lg:w-5 text-orange-600 rounded border-gray-300 cursor-pointer" />
                          <span className="ml-4 lg:ml-3 text-base lg:text-sm font-bold text-gray-800">{getTranslatedName(event)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 lg:hidden border-t border-gray-100 bg-white shrink-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
               <button onClick={() => setIsMobileFilterOpen(false)} className="w-full bg-gray-900 text-white font-black text-lg py-4 rounded-2xl shadow-xl active:scale-95 transition-transform">{t('btn_apply_filters', '結果を表示する')}</button>
            </div>
          </aside>

          <main className="flex-1">
            <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('label_search_results', '検索結果')}</h2>
              <div className="flex items-center gap-3">
                {loading && page === 0 && (
                  <span className="text-orange-500 font-bold text-sm animate-pulse flex items-center gap-2">
                    {t('searching', '検索中...')}
                    {isSlowData && <span className="text-[10px] bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">Slow connection</span>}
                  </span>
                )}
                <span className="text-gray-500 font-bold text-sm bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">{t('label_places_count', '{{count}} 店舗', { count: totalCount })}</span>
              </div>
            </div>

            <div className={`transition-opacity duration-300 ${loading && page === 0 ? 'opacity-40' : 'opacity-100'}`}>
              {restaurants.length === 0 && !loading ? (
                <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-200 px-6">
                  <p className="text-2xl text-gray-800 font-black mb-2">{t('label_no_results', '条件に一致するレストランが見つかりません。')}</p>
                  <p className="text-gray-500 font-medium text-sm mb-6">{t('not_found_desc', 'フィルターを変更するか、検索キーワードを調整してください。')}</p>
                  <button onClick={clearFilters} className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl">{t('btn_clear_filters', 'すべてクリア')}</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-24 md:pb-10">
                  {restaurants.map((restaurant, index) => {
                    const isLast = restaurants.length === index + 1;
                    const inlineAds = ads.filter(a => a.mobile_fallback === 'inline' && a.mobile_index === index);

                    return (
                      <React.Fragment key={restaurant.id}>
                        {inlineAds.map(ad => (
                          <a key={`inline-ad-${ad.id}`} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditor) { e.preventDefault(); window.parent.postMessage({ type: 'AD_STUDIO_SELECT', id: ad.id }, '*'); } }} className={`sm:hidden block w-full bg-white rounded-[2rem] shadow-sm border overflow-hidden group transition-all duration-300 ${selectedAdId === ad.id ? 'ring-4 ring-indigo-500 border-indigo-500 scale-[1.02]' : 'border-gray-200 hover:shadow-xl'}`}>
                            <div className="relative h-48 w-full overflow-hidden">
                               <img src={ad.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Sponsored" />
                               <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">{t('ad_label', 'Ad')}</div>
                            </div>
                            <div className="p-5 flex items-center justify-between bg-white">
                              <div className="flex flex-col">
                                <span className="font-black text-lg text-gray-900">{t('ad_partner_title', 'Featured Partner')}</span>
                                <span className="text-xs font-bold text-gray-400 mt-0.5">{t('ad_view_details', 'Tap to view details')}</span>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">→</div>
                            </div>
                          </a>
                        ))}
                        
                        <div ref={isLast ? lastElementRef : null}>
                          <RestaurantCard 
                            restaurant={restaurant} 
                            activeEvents={activeEvents} 
                            userLocation={userLocation} 
                            activeFilters={{ seatCapacity, campusSort }}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
              
              {loading && page > 0 && (
                <div className="w-full text-center py-8">
                  <span className="text-orange-500 font-bold text-sm animate-pulse">{t('loading_more', 'Loading more...')}</span>
                </div>
              )}
            </div>
          </main>
        </div>

        {bottomAds.length > 0 && (
          <div className="w-full max-w-3xl mx-auto px-4 mt-4">
            {bottomAds.map(ad => (
              <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditor) { e.preventDefault(); window.parent.postMessage({ type: 'AD_STUDIO_SELECT', id: ad.id }, '*'); } }} className={`lg:hidden block w-full bg-white rounded-[2rem] shadow-sm border overflow-hidden mb-6 group transition-all duration-300 ${selectedAdId === ad.id ? 'ring-4 ring-indigo-500 border-indigo-500 scale-[1.02]' : 'border-gray-200 hover:shadow-xl'}`}>
                <div className="relative h-48 w-full overflow-hidden">
                  <img src={ad.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Sponsored" />
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">{t('ad_sponsored_label', 'Sponsored')}</div>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-black text-lg text-gray-900">{t('ad_discover_title', 'Discover More')}</span>
                    <span className="text-xs font-bold text-gray-400 mt-0.5">{t('ad_discover_desc', 'Tap to explore')}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">→</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}