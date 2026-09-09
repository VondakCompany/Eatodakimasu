// app/restaurant/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];

export default function RestaurantPage({ params }: { params: { id: string } }) {
  const { currentLang, t } = useLanguage();
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [restRes, filterRes] = await Promise.all([
          supabase.from('restaurants').select('*').eq('id', params.id).single(),
          supabase.from('filter_options').select('*')
        ]);

        if (restRes.error) throw restRes.error;
        setRestaurant(restRes.data);
        if (filterRes.data) setMasterFilters(filterRes.data);
        
      } catch (err: any) {
        setError(err.message || 'Failed to load restaurant details.');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-orange-500"></div>
          <p className="text-gray-400 font-bold tracking-widest text-sm uppercase">{t('loading', '読み込み中...')}</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h1 className="text-3xl font-black text-gray-900 mb-2">{t('error_shop_not_found', '店舗が見つかりません')}</h1>
        <p className="text-gray-500 font-medium mb-8 max-w-md">{error || t('error_shop_not_found_desc', 'お探しの店舗は見つかりませんでした。削除されたか、非公開になっています。')}</p>
        <Link href="/" className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition shadow-lg">
          {t('btn_return_home', 'ホームに戻る')}
        </Link>
      </div>
    );
  }

  const getLocalized = (key: string, originalValue: any) => {
    if (currentLang === 'ja') return originalValue;
    return restaurant?.translations?.[currentLang]?.[key] || originalValue;
  };

  const getTranslatedTag = (tagName: string) => {
    if (currentLang === 'ja') return tagName;
    const filterOption = masterFilters.find(f => f.name === tagName);
    return filterOption?.translations?.[currentLang] || tagName;
  };

  const localizedTitle = getLocalized('title', restaurant.title);
  const localizedDescription = getLocalized('description', restaurant.description);
  const localizedTakeoutMenu = getLocalized('takeout_menu', restaurant.takeout_menu);
  const localizedDiscountInfo = getLocalized('discount_info', restaurant.discount_info);
  const localizedFullMenu = getLocalized('full_menu', restaurant.full_menu);
  const localizedMenuItems = getLocalized('menu_items', restaurant.menu_items);

  // 🚀 BULLETPROOF OPERATING HOURS PARSER
  let parsedHours: any = {};
  try {
    if (typeof restaurant.operating_hours === 'string' && restaurant.operating_hours.trim().startsWith('{')) {
      parsedHours = JSON.parse(restaurant.operating_hours);
    } else if (typeof restaurant.operating_hours === 'object' && restaurant.operating_hours !== null) {
      parsedHours = restaurant.operating_hours;
    }
  } catch (e) {
    console.error('Failed to parse operating hours', e);
  }

  // Check if it's actually the new 7-Day grid data structure with at least one filled-in day
  const hasValidGridData = typeof parsedHours === 'object' 
    && parsedHours !== null 
    && !Array.isArray(parsedHours) 
    && DAYS.some(day => !!parsedHours[day]);

  // Fallback engine for empty templates, strings, or old array formats
  const getFallbackHours = () => {
    if (!restaurant.operating_hours) return t('label_hours_not_provided', '営業時間が提供されていません');
    
    // Catch empty JSON grid templates (e.g., {"月曜日": "", ...})
    if (typeof parsedHours === 'object' && parsedHours !== null && !Array.isArray(parsedHours)) {
      const hasAnyValue = Object.values(parsedHours).some(val => typeof val === 'string' && val.trim() !== '');
      if (!hasAnyValue) return t('label_hours_not_provided', '営業時間が提供されていません');
    }

    if (typeof restaurant.operating_hours === 'string') return restaurant.operating_hours;
    if (Array.isArray(restaurant.operating_hours)) return restaurant.operating_hours.join('\n');
    return JSON.stringify(restaurant.operating_hours);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-in fade-in duration-500">
      
      {/* HERO SECTION */}
      <div className="w-full h-[40vh] md:h-[50vh] bg-gray-200 relative">
        {restaurant.image_url ? (
          <img src={restaurant.image_url} alt={localizedTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200">
            <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span className="font-black tracking-widest uppercase text-xs">{t('no_photo', '写真なし')}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        
        <div className="absolute top-6 left-6 z-10">
          <Link href="/" className="bg-white/20 backdrop-blur-md hover:bg-white/40 border border-white/30 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition">
             ← {t('btn_back', '戻る')}
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-4">
            {restaurant.restaurant_area && restaurant.restaurant_area.map((area: string, idx: number) => (
              <span key={idx} className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                {getTranslatedTag(area)}
              </span>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">{localizedTitle}</h1>
          <p className="text-orange-400 font-black text-xl flex items-center gap-2">
            ¥{restaurant.restaurant_price || '---'} 
            <span className="text-gray-300 font-medium text-sm">{t('label_avg_per_person', '平均予算')}</span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        
        {/* MAIN CONTENT (LEFT COLUMN) */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="flex flex-wrap gap-2">
            {['cuisine', 'food_restrictions', 'other_options'].map((field) => (
              (restaurant[field] || []).map((tag: string, idx: number) => (
                <span key={`${field}-${idx}`} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-700 shadow-sm">
                  {getTranslatedTag(tag)}
                </span>
              ))
            ))}
          </div>

          {localizedDescription && (
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">{t('label_about_shop', '店舗について')}</h2>
              <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{localizedDescription}</p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3 mb-6">
              📋 {t('label_menu', 'メニュー')}
            </h2>
            <div className="bg-gray-50 rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm">
              
              {localizedMenuItems && localizedMenuItems.length > 0 ? (
                <div className="overflow-x-auto mb-8">
                  <table className="w-full text-left border-collapse min-w-[400px]">
                    <tbody className="divide-y divide-gray-200/60">
                      {localizedMenuItems.map((item: any, idx: number) => (
                        <tr key={idx} className="group">
                          <td className="py-5 pr-4 align-top w-2/3">
                            <div className="font-black text-gray-900 text-lg mb-1">{item.name}</div>
                            {item.description && <div className="text-sm font-medium text-gray-500 leading-relaxed">{item.description}</div>}
                          </td>
                          <td className="py-5 font-black text-gray-900 text-right align-top whitespace-nowrap text-lg">
                            ¥{item.price || '---'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : localizedFullMenu ? (
                <div className="mb-8 whitespace-pre-wrap font-medium text-gray-700 leading-relaxed">
                  {localizedFullMenu}
                </div>
              ) : (
                <p className="text-gray-500 italic font-medium mb-8">{t('label_menu_coming_soon', 'メニュー詳細は準備中です。')}</p>
              )}

              {localizedTakeoutMenu && (
                <>
                  <hr className="border-gray-200/60 mb-8" />
                  <div>
                    <h3 className="text-xs font-black text-[#8B3A1A] uppercase tracking-widest mb-3">{t('label_takeout_menu', 'テイクアウトメニュー')}</h3>
                    <p className="text-gray-800 font-bold leading-relaxed whitespace-pre-wrap">{localizedTakeoutMenu}</p>
                  </div>
                </>
              )}
            </div>
          </section>
          
          {restaurant.image_urls && restaurant.image_urls.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-black text-gray-900 px-2">{t('label_gallery', 'ギャラリー')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {restaurant.image_urls.map((url: string, idx: number) => (
                  <div key={idx} className="aspect-square bg-gray-200 rounded-[24px] overflow-hidden border border-gray-100 shadow-sm">
                    <img src={url} alt={`Gallery image ${idx + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500 cursor-pointer" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* SIDEBAR INFO (RIGHT COLUMN) */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-8 sticky top-8">
            
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('label_location', 'アクセス')}</h3>
              <p className="text-gray-900 font-bold text-sm leading-relaxed">{restaurant.address || t('label_address_not_provided', '住所が提供されていません')}</p>
              
              {restaurant.lat && restaurant.lng && (
                 <a href={`https://www.google.com/maps/search/?api=1&query=${restaurant.lat},${restaurant.lng}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black text-gray-700 transition">
                   {t('btn_open_maps', 'Google Mapsで開く')}
                 </a>
              )}
              
              {/* 🚀 BULLETPROOF WEBSITE LINK */}
              {restaurant.website_url && (
                <a 
                  href={restaurant.website_url.startsWith('http') ? restaurant.website_url : `https://${restaurant.website_url}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-3 flex items-center justify-center w-full py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-xs font-black text-blue-600 transition"
                >
                  {t('btn_visit_website', '公式サイトを見る')}
                </a>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* DYNAMIC OPERATING HOURS BLOCK */}
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{t('label_operating_hours', '営業時間')}</h3>
              {hasValidGridData ? (
                <div className="space-y-3">
                  {DAYS.map(day => (
                    parsedHours[day] ? (
                      <div key={day} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-500 text-xs">{t(`day_${day}`, day)}</span>
                        <span className="font-black text-gray-900">{parsedHours[day]}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              ) : (
                <p className="text-gray-900 font-black text-sm whitespace-pre-wrap">{getFallbackHours()}</p>
              )}
            </div>

            <hr className="border-gray-100" />

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('label_total_seats', '席数')}</h3>
                <p className="font-black text-base text-gray-900">{restaurant.total_seats || '---'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('label_avg_stay', '平均滞在時間')}</h3>
                <p className="font-black text-base text-gray-900">{restaurant.avg_stay_time || '---'}</p>
              </div>
            </div>

            {restaurant.payment_methods && restaurant.payment_methods.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('label_payments', '決済方法')}</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.payment_methods.map((method: string, idx: number) => (
                    <span key={idx} className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
                      {getTranslatedTag(method)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {localizedDiscountInfo && (
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
                <h3 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  ⭐ {t('label_special_offers', '特別オファー')}
                </h3>
                <p className="text-sm font-bold text-yellow-900">{localizedDiscountInfo}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}