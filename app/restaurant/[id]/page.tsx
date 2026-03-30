'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { currentLang, t } = useLanguage();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [allCategories, setAllCategories] = useState<any[]>([]); 
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const resolvedParams = await params; 
      
      const [resResult, catResult, adsResult] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', resolvedParams.id).single(),
        supabase.from('custom_categories').select('*'),
        supabase.from('ad_campaigns').select('*').eq('is_active', true).in('target_page', ['*', '/restaurant/*', `/restaurant/${resolvedParams.id}`])
      ]);

      if (resResult.data) setRestaurant(resResult.data);
      if (catResult.data) setAllCategories(catResult.data);
      if (adsResult.data) setAds(adsResult.data);
      setLoading(false);
    };

    fetchData();
  }, [params]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="text-orange-500 font-bold text-xl animate-pulse">{t('searching', '検索中...')}</span>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-24 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-gray-900 mb-4">{t('label_no_results', '見つかりませんでした。')}</h1>
        <Link href="/" className="text-orange-600 font-bold hover:underline">← {t('btn_back_search', '検索に戻る')}</Link>
      </div>
    );
  }

  const openLightbox = (index: number) => { setLightboxIndex(index); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);
  const nextImage = (e: React.MouseEvent) => { e.stopPropagation(); setLightboxIndex((prev) => (prev + 1) % restaurant.image_urls.length); };
  const prevImage = (e: React.MouseEvent) => { e.stopPropagation(); setLightboxIndex((prev) => (prev - 1 + restaurant.image_urls.length) % restaurant.image_urls.length); };

  const formatOperatingHours = (hours: any) => {
    if (!hours) return '';
    if (typeof hours === 'string') {
      try {
        const parsed = JSON.parse(hours);
        return Object.entries(parsed).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
      } catch { return hours; }
    }
    if (typeof hours === 'object') {
      return Object.entries(hours).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    }
    return String(hours);
  };

  const displayHours = formatOperatingHours(restaurant.operating_hours);
  const displayTitle = currentLang === 'ja' ? restaurant.title : (restaurant.translations?.[currentLang]?.title || restaurant.title);
  const displayDescription = currentLang === 'ja' ? restaurant.description : (restaurant.translations?.[currentLang]?.description || restaurant.description);
  const displayMenu = currentLang === 'ja' ? restaurant.full_menu : (restaurant.translations?.[currentLang]?.full_menu || restaurant.full_menu);
  const displayTakeout = currentLang === 'ja' ? restaurant.takeout_menu : (restaurant.translations?.[currentLang]?.takeout_menu || restaurant.takeout_menu);

  const mapEmbedUrl = restaurant.address ? `https://maps.google.com/maps?q=${encodeURIComponent(restaurant.address)}&t=&z=16&ie=UTF8&iwloc=&output=embed` : null;
  const mapOutboundLink = restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null;

  const handleShare = async () => {
    const shareData = { title: displayTitle, text: displayDescription?.substring(0, 50) + '...', url: window.location.href };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch (err) { console.error(err); }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(t('share_copied', 'リンクをコピーしました！ / Link copied!'));
    }
  };

  return (
    <>
      {/* DESKTOP AD LAYER */}
      <div className="hidden lg:block absolute top-0 left-1/2 transform -translate-x-1/2 w-[1600px] h-0 z-40 pointer-events-none">
        {ads.map(ad => (
          <a 
            key={ad.id} 
            href={ad.action_url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute pointer-events-auto rounded-[1.5rem] overflow-hidden transition hover:opacity-90 bg-gray-50"
            style={{ left: ad.x, top: ad.y, width: ad.w, height: ad.h }}
          >
            <img src={ad.image_url} className="w-full h-full object-cover" alt="Advertisement" />
          </a>
        ))}
      </div>

      {/* MOBILE STICKY AD LAYER */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {ads.filter(a => a.mobile_fallback === 'sticky').map(ad => (
          <a 
            key={ad.id} 
            href={ad.action_url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full h-20 bg-white flex items-center px-5 gap-4 border-t border-gray-200 pointer-events-auto hover:bg-gray-50 transition"
          >
            <img src={ad.image_url} className="w-12 h-12 rounded-xl object-cover" alt="Sponsored" />
            <div className="flex flex-col flex-1 truncate">
              <span className="font-black text-sm text-gray-900">Special Promo</span>
              <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wide">Sponsored</span>
            </div>
            <span className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-xs font-black">Open</span>
          </a>
        ))}
      </div>

      {/* FULLSCREEN LIGHTBOX OVERLAY */}
      {lightboxOpen && restaurant.image_urls && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={closeLightbox}>
          <button className="absolute top-6 right-8 text-white/70 hover:text-white text-4xl font-light transition-colors z-50" onClick={closeLightbox}>✕</button>
          {restaurant.image_urls.length > 1 && (
            <button className="absolute left-4 md:left-8 text-white/50 hover:text-white text-5xl md:text-6xl p-4 transition-colors z-50 select-none" onClick={prevImage}>‹</button>
          )}
          <div className="relative max-w-5xl max-h-[85vh] w-full px-12 md:px-24 flex justify-center items-center select-none">
            <img src={restaurant.image_urls[lightboxIndex]} alt={`${displayTitle} gallery full`} className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-sm pointer-events-auto" onClick={(e) => e.stopPropagation()} />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-sm tracking-widest font-mono">{lightboxIndex + 1} / {restaurant.image_urls.length}</div>
          </div>
          {restaurant.image_urls.length > 1 && (
            <button className="absolute right-4 md:right-8 text-white/50 hover:text-white text-5xl md:text-6xl p-4 transition-colors z-50 select-none" onClick={nextImage}>›</button>
          )}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mt-4 md:mt-8 mb-24 relative z-10">
        
        <div className="h-64 md:h-96 w-full relative bg-gray-900 group">
          <img src={restaurant.image_url || "/images/default.jpg"} alt={displayTitle} className="object-cover w-full h-full opacity-60 absolute inset-0 z-0" />
          <div className="absolute top-6 left-6 right-6 flex justify-between z-10">
            <Link href="/" className="bg-white/90 backdrop-blur text-gray-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-white transition shadow-sm">{t('btn_back_search', '← 検索に戻る')}</Link>
            <button onClick={handleShare} className="bg-white/90 backdrop-blur text-gray-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-white transition shadow-sm flex items-center gap-2"><span>↗</span> {t('btn_share', 'シェア')}</button>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-100 pb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2">{displayTitle}</h1>
              {restaurant.participates_in_event && <span className="inline-block mt-2 mb-2 bg-pink-100 text-pink-800 text-sm font-black px-4 py-1.5 rounded-full shadow-sm border border-pink-200">{t('badge_event_full', '🎉 イベント参加店舗')}</span>}
              {restaurant.cuisine && restaurant.cuisine.length > 0 && <p className="text-orange-600 font-bold mt-2">{restaurant.cuisine.map((c: string) => t(`tag_${c}`, c)).join(' • ')}</p>}
            </div>
            {restaurant.restaurant_price && (
              <span className="bg-orange-50 text-orange-800 text-lg font-black px-6 py-3 rounded-2xl border border-orange-100 whitespace-nowrap shadow-sm">
                {t('price_estimate', '目安: ¥{{price}}〜', { price: restaurant.restaurant_price })}
              </span>
            )}
          </div>

          {displayDescription && <p className="text-lg text-gray-700 mb-12 leading-relaxed whitespace-pre-wrap">{displayDescription}</p>}

          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center"><span className="text-3xl mr-3">📋</span> {t('label_menu_full', 'メニュー')}</h2>
            <div className="bg-gray-50 p-6 md:p-8 rounded-3xl border border-gray-100">
              {displayMenu ? <div className="text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">{displayMenu}</div> : <p className="text-gray-500 italic">{t('menu_coming_soon', 'メニューの詳細は現在準備中です。')}</p>}
              {restaurant.takeout_available && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-black text-orange-900 uppercase tracking-wider mb-3 flex items-center">{t('label_takeout_full', '🛍️ テイクアウトメニュー')}</h3>
                  <p className="text-gray-800 font-medium">{displayTakeout || t('takeout_available', 'テイクアウト対応あり')}</p>
                </div>
              )}
            </div>
          </div>

          {restaurant.image_urls && restaurant.image_urls.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center"><span className="text-3xl mr-3">📸</span> {t('label_gallery', 'ギャラリー')}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {restaurant.image_urls.map((url: string, idx: number) => (
                  <button key={idx} onClick={() => openLightbox(idx)} className="aspect-square rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 group focus:outline-none focus:ring-4 focus:ring-orange-500/30">
                    <img src={url} alt={`${displayTitle} thumbnail ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-90 transition duration-300" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {restaurant.other_options && restaurant.other_options.length > 0 && (
            <div className="space-y-6 mb-12">
              <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center"><span className="text-3xl mr-3">🎉</span> {t('label_events_campaigns', 'イベント＆キャンペーン')}</h2>
              {restaurant.other_options.map((catName: string) => {
                const categoryData = allCategories.find(c => c.name === catName);
                const isConstant = categoryData?.is_constant === true;
                const globalDesc = categoryData ? (currentLang === 'ja' ? categoryData.description : (categoryData.translations?.[currentLang]?.description || categoryData.description)) : '';
                const baseCollab = restaurant.category_collabs?.[catName];
                const localizedCollab = currentLang === 'ja' ? baseCollab : (restaurant.translations?.[currentLang]?.category_collabs?.[catName] || baseCollab);

                return (
                  <div key={catName} className={`p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden border ${isConstant ? 'bg-slate-50 border-slate-200' : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100'}`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 rounded-bl-full -z-0 ${isConstant ? 'bg-slate-900' : 'bg-purple-500'}`}></div>
                    <h3 className={`text-xl font-black mb-3 relative z-10 ${isConstant ? 'text-slate-900' : 'text-purple-900'}`}>{t(`tag_${catName}`, catName)}</h3>
                    {globalDesc && <p className={`text-sm font-medium mb-6 leading-relaxed relative z-10 whitespace-pre-wrap pb-4 border-b ${isConstant ? 'text-slate-700 border-slate-200' : 'text-purple-800/80 border-purple-200/50'}`}>{globalDesc}</p>}
                    {localizedCollab && (
                      <div className="relative z-10">
                        <h4 className={`text-xs font-black uppercase tracking-wider mb-2 ${isConstant ? 'text-slate-500' : 'text-purple-700'}`}>{t('label_shop_collab', '店舗限定コラボ内容')}</h4>
                        <p className={`font-bold whitespace-pre-wrap leading-relaxed p-4 rounded-xl border ${isConstant ? 'text-slate-900 bg-white border-slate-200' : 'text-gray-900 bg-white/60 border-purple-100'}`}>{localizedCollab}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5">{t('label_info', '店舗情報')}</h3>
              <ul className="space-y-4 text-gray-800 font-medium">
                {displayHours && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">🕒</span> <span className="whitespace-pre-wrap leading-relaxed">{displayHours}</span></li>}
                {restaurant.restaurant_area && restaurant.restaurant_area.length > 0 && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">🗺️</span> {restaurant.restaurant_area.map((a: string) => t(`tag_${a}`, a)).join('、 ')}</li>}
                {restaurant.total_seats && <li className="flex items-start">{t('label_seats', '🪑 座席数: {{seats}}', { seats: restaurant.total_seats })}</li>}
                {restaurant.avg_stay_time && <li className="flex items-start">{t('label_stay_time', '⏳ 滞在時間: {{time}}', { time: restaurant.avg_stay_time })}</li>}
                {restaurant.payment_methods && restaurant.payment_methods.length > 0 && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">💳</span> {restaurant.payment_methods.map((p: string) => t(`tag_${p}`, p)).join('、 ')}</li>}
              </ul>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
               <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5">{t('filter_dietary', '食事制限')}</h3>
               {restaurant.food_restrictions && restaurant.food_restrictions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {restaurant.food_restrictions.map((res: string, i: number) => <span key={i} className="bg-green-100 text-green-800 text-sm font-bold px-4 py-2 rounded-xl border border-green-200">{t(`tag_${res}`, res)}</span>)}
                  </div>
               ) : <p className="text-gray-500 font-medium">{t('no_dietary_info', '特別な対応表記なし')}</p>}
            </div>
          </div>
        </div>

        {restaurant.address && (
          <div className="bg-gray-50 border-t border-gray-200 p-8 md:p-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">{t('label_access', 'アクセス')}</h2>
                <p className="text-gray-800 font-bold text-lg flex items-start"><span className="mr-2">📍</span> {restaurant.address}</p>
              </div>
              <a href={mapOutboundLink || '#'} target="_blank" rel="noopener noreferrer" className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800 transition shadow-md whitespace-nowrap">{t('btn_open_map', 'マップアプリで開く ↗')}</a>
            </div>
            {mapEmbedUrl && (
              <div className="w-full h-80 md:h-96 rounded-3xl overflow-hidden border border-gray-200 shadow-inner bg-gray-200 mt-6">
                <iframe title={`Map of ${displayTitle}`} width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src={mapEmbedUrl} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}