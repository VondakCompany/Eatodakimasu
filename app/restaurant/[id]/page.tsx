// /app/restaurant/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import * as JapaneseHolidays from 'japanese-holidays';

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];
const DAY_HEADERS = ['日', '月', '火', '水', '木', '金', '土'];

const checkIfOpenRightNow = (hoursStr: string) => {
  if (!hoursStr || hoursStr.includes('休業') || hoursStr.includes('休み')) return false;
  const now = new Date();
  const jstStr = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  const jstDate = new Date(jstStr);
  const currentMinutes = jstDate.getHours() * 60 + jstDate.getMinutes();

  const timeRanges = hoursStr.matchAll(/(\d{1,2}):(\d{2})\s*[-~～]\s*(\d{1,2}):(\d{2})/g);
  let isOpen = false;

  for (const match of Array.from(timeRanges)) {
    const startH = parseInt(match[1], 10);
    const startM = parseInt(match[2], 10);
    let endH = parseInt(match[3], 10);
    const endM = parseInt(match[4], 10);

    const startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    if (endH < startH || endH >= 24) {
      if (endH < startH) endTotal += 24 * 60;
    }

    let adjustedCurrent = currentMinutes;
    if (currentMinutes < startTotal && endTotal > 24 * 60) {
      adjustedCurrent += 24 * 60;
    }

    if (adjustedCurrent >= startTotal && adjustedCurrent <= endTotal) {
      isOpen = true;
      break;
    }
  }
  return isOpen;
};

// 🚀 ROLLING CALENDAR ENGINE (60-Day Customer View with Modified Hours Support)
const generateRollingSchedule = (parsedHours: any, tempClosures: any[], todayTempStatus: string, days = 60) => {
  const calendar = [];
  const today = new Date();
  const jstStr = today.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  const jstToday = new Date(jstStr);

  for (let i = 0; i < days; i++) {
    const targetDate = new Date(jstToday);
    targetDate.setDate(jstToday.getDate() + i);
    
    const ymd = targetDate.toISOString().split('T')[0];
    const isToday = i === 0;
    
    const isHoliday = JapaneseHolidays.isHoliday(targetDate);
    const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const baseDayKey = isHoliday ? '祝日' : dayNames[targetDate.getDay()];
    
    let hoursText = parsedHours[baseDayKey] || '休業';
    let status = hoursText.includes('休業') || hoursText.includes('休み') ? 'closed' : 'open';
    let overrideReason = null;

    if (isToday && status === 'open') {
      if (!checkIfOpenRightNow(hoursText)) {
        status = 'closed';
      }
    }

    const scheduledClosure = (tempClosures || []).find((c: any) => c.date === ymd);
    if (scheduledClosure) {
      if (scheduledClosure.customHours) {
        status = 'modified';
        hoursText = scheduledClosure.customHours;
        overrideReason = scheduledClosure.reason || '短縮/変更営業';
      } else {
        status = 'temp_closed';
        hoursText = '臨時休業';
        overrideReason = scheduledClosure.reason || '臨時休業';
      }
    }

    if (isToday) {
      if (todayTempStatus === 'sold_out') {
        status = 'sold_out';
        hoursText = '本日終了 (Sold Out)';
      } else if (todayTempStatus === 'temp_closed') {
        status = 'temp_closed';
        hoursText = '臨時休業';
      }
    }

    calendar.push({
      date: targetDate,
      ymd,
      year: targetDate.getFullYear(),
      month: targetDate.getMonth() + 1,
      displayDate: `${targetDate.getMonth() + 1}/${targetDate.getDate()}`,
      dayName: isHoliday ? '祝' : DAY_HEADERS[targetDate.getDay()],
      dayIndex: targetDate.getDay(),
      isHoliday,
      isToday,
      status,
      hoursText,
      overrideReason
    });
  }
  return calendar;
};

export default function RestaurantPage({ params }: { params: { id: string } }) {
  const { currentLang, t } = useLanguage();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🚀 CALENDAR PAGER STATE
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [restRes, filterRes] = await Promise.all([
          // 🚀 SAFE FETCH: Excluded missing columns that caused the crash
          supabase.from('restaurants').select(`
            id, 
            title, 
            description, 
            menu_items, 
            operating_hours, 
            image_url, 
            image_urls, 
            restaurant_price, 
            cuisine, 
            food_restrictions, 
            other_options, 
            address, 
            lat, 
            lng, 
            website_url, 
            total_seats, 
            avg_stay_time, 
            payment_methods, 
            temporary_status,
            daily_announcement,
            temporary_closures,
            custom_fields
          `).eq('id', params.id).single(),
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
    if (params.id) fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600"></div>
          <p className="text-gray-400 font-bold tracking-widest text-sm uppercase">{t('loading', '読み込み中...')}</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h1 className="text-3xl font-black text-gray-900 mb-2">{t('error_shop_not_found', '店舗が見つかりません')}</h1>
        <p className="text-gray-500 font-medium mb-8 max-w-md">{error || t('error_shop_not_found_desc', 'お探しの店舗は見つかりませんでした。')}</p>
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
  
  // Handled safely in case columns weren't fetched
  const localizedTakeoutMenu = restaurant.takeout_menu ? getLocalized('takeout_menu', restaurant.takeout_menu) : null;
  const localizedDiscountInfo = restaurant.discount_info ? getLocalized('discount_info', restaurant.discount_info) : null;
  const localizedFullMenu = restaurant.full_menu ? getLocalized('full_menu', restaurant.full_menu) : null;

  const coreMenuItems = restaurant.menu_items || [];
  const customFields = restaurant.custom_fields || {};

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

  const hasValidGridData = typeof parsedHours === 'object'
    && parsedHours !== null
    && !Array.isArray(parsedHours)
    && DAYS.some(day => !!parsedHours[day]);

  const getFallbackHours = () => {
    if (!restaurant.operating_hours) return t('label_hours_not_provided', '営業時間が提供されていません');
    if (typeof parsedHours === 'object' && parsedHours !== null && !Array.isArray(parsedHours)) {
      const hasAnyValue = Object.values(parsedHours).some(val => typeof val === 'string' && val.trim() !== '');
      if (!hasAnyValue) return t('label_hours_not_provided', '営業時間が提供されていません');
    }
    if (typeof restaurant.operating_hours === 'string') return restaurant.operating_hours;
    if (Array.isArray(restaurant.operating_hours)) return restaurant.operating_hours.join('\n');
    return JSON.stringify(restaurant.operating_hours);
  };

  // 🚀 60-Day Lookahead for Public View
  const schedule = generateRollingSchedule(parsedHours, restaurant.temporary_closures || [], restaurant.temporary_status || 'normal', 60);

  // Group by month for the PC grid
  const scheduleByMonth = schedule.reduce((acc: any, day: any) => {
    const monthLabel = `${day.year}年 ${day.month}月`;
    if (!acc[monthLabel]) acc[monthLabel] = [];
    acc[monthLabel].push(day);
    return acc;
  }, {} as Record<string, any[]>);

  const monthKeys = Object.keys(scheduleByMonth);
  const currentMonthLabel = monthKeys[currentMonthIndex];
  const currentMonthDays = scheduleByMonth[currentMonthLabel] || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-in fade-in duration-500">

      {restaurant.daily_announcement && (
        <div className="bg-blue-600 text-white p-3.5 text-center font-black text-sm flex items-center justify-center gap-2 shadow-inner">
          <span className="animate-pulse">📢</span>
          <span>{restaurant.daily_announcement}</span>
        </div>
      )}

      <div className="w-full h-[40vh] md:h-[50vh] bg-gray-200 relative">
        {restaurant.image_url ? (
          <img src={restaurant.image_url} alt={localizedTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200">
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
              <span key={idx} className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                {getTranslatedTag(area)}
              </span>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">{localizedTitle}</h1>
          <p className="text-blue-400 font-black text-xl flex items-center gap-2">
            {restaurant.restaurant_price ? `¥${restaurant.restaurant_price}` : '---'}
            <span className="text-gray-300 font-medium text-sm">{t('label_avg_per_person', '平均予算')}</span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 relative">

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
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                🏠 {t('label_about_shop', '店舗について')}
              </h2>
              <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{localizedDescription}</p>
            </section>
          )}

          {localizedDiscountInfo && (
            <section className="bg-amber-50 p-6 rounded-[28px] border border-amber-200/60 shadow-sm">
              <h3 className="text-amber-900 font-black text-base mb-2 flex items-center gap-2">
                🎁 {t('label_discount_info', 'お得情報・特典')}
              </h3>
              <p className="text-amber-800 text-sm font-bold leading-relaxed whitespace-pre-wrap">{localizedDiscountInfo}</p>
            </section>
          )}

          {localizedTakeoutMenu && (
            <section className="bg-emerald-50 p-6 rounded-[28px] border border-emerald-200/60 shadow-sm">
              <h3 className="text-emerald-900 font-black text-base mb-2 flex items-center gap-2">
                🥡 {t('label_takeout_info', 'テイクアウト情報')}
              </h3>
              <p className="text-emerald-800 text-sm font-bold leading-relaxed whitespace-pre-wrap">{localizedTakeoutMenu}</p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3 mb-6">
              📋 {t('label_menu', 'メニュー')}
            </h2>
            <div className="bg-white rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm">

              {coreMenuItems && coreMenuItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[400px]">
                    <tbody className="divide-y divide-gray-100">
                      {coreMenuItems.map((item: any, idx: number) => (
                        <tr key={idx} className={`group ${item.isSoldOut ? 'opacity-50 grayscale bg-gray-50/50' : ''}`}>
                          <td className="py-5 pr-4 align-top w-2/3">
                            <div className="font-black text-gray-900 text-lg mb-1 flex items-center flex-wrap gap-2">
                              <span>{item.name}</span>
                              {item.isSoldOut && (
                                <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-md tracking-widest uppercase">
                                  Sold Out
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <div className="text-sm font-medium text-gray-500 leading-relaxed">{item.description}</div>
                            )}
                          </td>
                          <td className="py-5 font-black text-gray-900 text-right align-top whitespace-nowrap text-lg">
                            {item.isSoldOut ? (
                              <span className="line-through text-gray-400">¥{item.price}</span>
                            ) : (
                              `¥${item.price ?? '---'}`
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : localizedFullMenu ? (
                <div className="whitespace-pre-wrap font-medium text-gray-700 leading-relaxed">
                  {localizedFullMenu}
                </div>
              ) : (
                <p className="text-gray-500 italic font-medium">{t('label_menu_coming_soon', 'メニュー詳細は準備中です。')}</p>
              )}
            </div>
          </section>

          {(customFields.payment_methods || customFields.phone || customFields.website || customFields.notes) && (
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-lg font-black text-gray-900 mb-4">{t('label_additional_info', '補足情報')}</h3>
              
              {customFields.phone && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider">{t('label_phone', '電話番号')}</span>
                  <a href={`tel:${customFields.phone}`} className="text-sm font-black text-blue-600 hover:underline">{customFields.phone}</a>
                </div>
              )}

              {customFields.payment_methods && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider">{t('label_payment', '決済方法')}</span>
                  <span className="text-sm font-bold text-gray-800">{customFields.payment_methods}</span>
                </div>
              )}

              {customFields.website && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider">{t('label_website', 'ウェブサイト')}</span>
                  <a href={customFields.website} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:underline truncate max-w-[200px]">
                    {customFields.website}
                  </a>
                </div>
              )}

              {customFields.notes && (
                <div className="pt-2">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">{t('label_notes', '備考')}</span>
                  <p className="text-sm font-medium text-gray-600 leading-relaxed whitespace-pre-wrap">{customFields.notes}</p>
                </div>
              )}
            </section>
          )}

        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-8 sticky top-8">

            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('label_location', 'アクセス')}</h3>
              <p className="text-gray-900 font-bold text-sm leading-relaxed mb-3">
                {restaurant.address || t('label_address_not_provided', '住所が提供されていません')}
              </p>
              {restaurant.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.title + ' ' + restaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 transition"
                >
                  📍 Google Maps で開く ↗
                </a>
              )}
            </div>

            <hr className="border-gray-100" />

            {hasValidGridData && (
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                  <span>{t('label_upcoming_schedule', '営業カレンダー')}</span>
                  <span className="text-[8px] text-gray-300 md:hidden">SWIPE →</span>
                </h3>

                {/* 📱 MOBILE VIEW: Horizontal Snap-Scroll */}
                <div className="md:hidden flex overflow-x-auto gap-3 pb-4 snap-x hide-scrollbar">
                  {schedule.map((day, idx) => (
                    <div key={idx} className={`snap-start shrink-0 w-24 p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                      day.status === 'open' ? 'bg-white border-green-200 shadow-sm' : 
                      day.isToday && day.status === 'sold_out' ? 'bg-orange-50 border-orange-200' :
                      day.status === 'modified' ? 'bg-yellow-50 border-yellow-200 shadow-inner' :
                      day.status === 'temp_closed' ? 'bg-red-50 border-red-200 shadow-inner' :
                      'bg-gray-50 border-gray-100 opacity-75'
                    }`}>
                      <span className={`text-[10px] font-black ${day.isHoliday ? 'text-red-500' : 'text-gray-400'}`}>
                        {day.displayDate} ({day.dayName})
                      </span>
                      <span className="text-xl my-1 drop-shadow-sm">
                        {day.status === 'open' ? '🟢' : day.status === 'modified' ? '🕒' : day.status === 'sold_out' ? '🟠' : '🔴'}
                      </span>
                      <span className={`text-[9px] font-bold line-clamp-2 ${day.status === 'open' ? 'text-gray-900' : day.status === 'modified' ? 'text-yellow-800' : day.status === 'sold_out' ? 'text-orange-700' : 'text-red-600'}`}>
                        {day.isToday && day.status === 'open' ? '営業中' : day.overrideReason || day.hoursText}
                      </span>
                      {day.status === 'modified' && (
                        <span className="text-[8px] font-black text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded mt-1">{day.hoursText}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 💻 PC VIEW: Month-by-Month Pager Calendar */}
                <div className="hidden md:block border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                  
                  <div className="flex justify-between items-center mb-4">
                    <button 
                      type="button"
                      onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentMonthIndex === 0}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition font-black text-gray-600 text-xs"
                    >
                      &lt;
                    </button>
                    <h5 className="text-sm font-black text-gray-900">{currentMonthLabel}</h5>
                    <button 
                      type="button"
                      onClick={() => setCurrentMonthIndex(prev => Math.min(monthKeys.length - 1, prev + 1))}
                      disabled={currentMonthIndex === monthKeys.length - 1}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition font-black text-gray-600 text-xs"
                    >
                      &gt;
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAY_HEADERS.map(h => (
                      <div key={h} className="text-center text-[10px] font-black text-gray-400">{h}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array(currentMonthDays[0]?.dayIndex || 0).fill(null).map((_, i) => (
                      <div key={`empty-${currentMonthLabel}-${i}`} className="p-2" />
                    ))}
                    
                    {currentMonthDays.map((day: any, idx: number) => (
                      <div key={`desk-${idx}`} className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-center group relative ${
                        day.status === 'open' ? 'bg-white border-green-200 shadow-sm' : 
                        day.isToday && day.status === 'sold_out' ? 'bg-orange-50 border-orange-200' :
                        day.status === 'modified' ? 'bg-yellow-50 border-yellow-300 shadow-inner' :
                        day.status === 'temp_closed' ? 'bg-red-50 border-red-200 shadow-inner' :
                        'bg-gray-50 border-gray-100 opacity-75'
                      }`}>
                        <span className={`text-[9px] font-black leading-none ${day.isHoliday ? 'text-red-500' : 'text-gray-400'}`}>
                          {day.displayDate.split('/')[1]}
                        </span>
                        <span className="text-[10px] mt-1">
                          {day.status === 'open' ? '🟢' : day.status === 'modified' ? '🕒' : day.status === 'sold_out' ? '🟠' : '🔴'}
                        </span>
                        <div className="absolute bottom-[105%] mb-2 hidden group-hover:block w-max max-w-[150px] bg-gray-900 text-white text-[10px] font-bold p-2 rounded-lg shadow-xl z-50 pointer-events-none">
                           <div className="mb-1 border-b border-gray-700 pb-1">{day.ymd} ({day.dayName})</div>
                           <div className={day.status === 'modified' ? 'text-yellow-400' : 'text-red-400'}>
                             {day.overrideReason || day.hoursText}
                           </div>
                           {day.status === 'modified' && (
                             <div className="bg-gray-800 text-white p-1 rounded mt-1">{day.hoursText}</div>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <hr className="border-gray-100" />

            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{t('label_operating_hours', '標準営業時間')}</h3>
              
              {hasValidGridData ? (
                <div className="flex flex-col gap-2.5">
                  {DAYS.map((day) => {
                    let dayHours = parsedHours[day];
                    if (!dayHours) return null;
                    return (
                      <div key={day} className="flex justify-between items-center text-sm py-1">
                        <span className="font-bold text-gray-500 text-xs">
                          {t(`day_${day}`, day)}
                        </span>
                        <span className="font-bold text-gray-900 text-xs md:text-sm text-right">
                          {dayHours}
                        </span>
                      </div>
                    );
                  })}
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

          </div>
        </div>

      </div>
    </div>
  );
}