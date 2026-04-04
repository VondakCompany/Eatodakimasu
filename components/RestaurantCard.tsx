'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RestaurantCard({ 
  restaurant, 
  activeEvents = [],
  userLocation,
  activeFilters = {}
}: { 
  restaurant: any; 
  activeEvents?: any[];
  userLocation?: { lat: number; lng: number } | null;
  activeFilters?: { seatCapacity?: string; campusSort?: string; };
}) {
  const { currentLang, t } = useLanguage();

  const displayTitle = currentLang === 'ja' 
    ? restaurant.title 
    : (restaurant.translations?.[currentLang]?.title || restaurant.title);
    
  const displayDescription = currentLang === 'ja' 
    ? restaurant.description 
    : (restaurant.translations?.[currentLang]?.description || restaurant.description);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightLineDist = R * c; 
    return straightLineDist * 1.3; 
  };

  let finalDistance = restaurant.dist_meters;
  if (finalDistance === undefined && userLocation && restaurant.lat && restaurant.lng) {
    finalDistance = calculateDistance(userLocation.lat, userLocation.lng, restaurant.lat, restaurant.lng);
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const walkFromUser = finalDistance !== undefined && !isNaN(finalDistance) ? Math.max(1, Math.ceil(finalDistance / 80)) : null;
  const walkFromCampus = restaurant.campus_dist_meters ? Math.max(1, Math.ceil(restaurant.campus_dist_meters / 80)) : null;

  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block group h-full">
      <div className="bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full flex flex-col relative transform group-hover:-translate-y-1">
        
        <div className="relative h-56 w-full bg-gray-100 overflow-hidden">
          <img 
            src={restaurant.image_url || '/images/default.jpg'} 
            alt={displayTitle} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-100 transition-opacity duration-300"></div>
          
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10 pl-12">
            {userLocation && finalDistance !== undefined && !isNaN(finalDistance) && (
              <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-gray-100/50">
                <span className="text-orange-500 font-bold text-[10px]">{t('badge_distance', '距離:')}</span>
                <span className="font-black text-gray-900 text-[10px] tracking-tight">{formatDistance(finalDistance)}</span>
                <span className="text-gray-300 mx-0.5">|</span>
                <span className="text-orange-500 font-bold text-[10px]">{t('badge_walk', '徒歩:')}</span>
                <span className="font-black text-gray-900 text-[10px] tracking-tight">{t('badge_min', '{{min}}分', { min: walkFromUser })}</span>
              </div>
            )}

            {activeFilters?.campusSort && walkFromCampus !== null && restaurant.campus_name && (
              <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-gray-100/50">
                <span className="text-indigo-500 font-bold text-[10px]">{t('badge_campus', 'キャンパス:')}</span>
                <span className="font-black text-gray-900 text-[10px] tracking-tight">
                  {t('badge_from_campus', '{{campus}}から {{min}}分', { campus: t(`tag_campus_${activeFilters.campusSort}`, restaurant.campus_name), min: walkFromCampus })}
                </span>
              </div>
            )}

            {activeFilters?.seatCapacity && restaurant.total_seats && (
              <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-gray-100/50">
                <span className="text-emerald-500 font-bold text-[10px]">{t('badge_seats', '席数:')}</span>
                <span className="font-black text-gray-900 text-[10px] tracking-tight">{restaurant.total_seats}</span>
              </div>
            )}
          </div>

          {restaurant.other_options && restaurant.other_options.length > 0 && activeEvents && (
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 z-10 pr-4">
              {restaurant.other_options.map((catName: string) => {
                const isConstant = activeEvents.find(e => e.name === catName)?.is_constant;
                return (
                  <div key={catName} className={`px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 border ${isConstant ? 'bg-slate-100/95 border-slate-200 text-slate-800' : 'bg-purple-100/95 border-purple-200 text-purple-800'}`}>
                    <span className="font-black text-[10px] tracking-tight">{t(`tag_${catName}`, catName)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-2 gap-2">
            <h3 className="text-xl font-black text-gray-900 leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">
              {displayTitle}
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {restaurant.cuisine && restaurant.cuisine.map((c: string) => (
              <span key={c} className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                {t(`tag_${c}`, c)}
              </span>
            ))}
          </div>

          {displayDescription && (
            <p className="text-sm text-gray-500 font-medium line-clamp-2 mb-6 leading-relaxed">
              {displayDescription}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-lg font-black text-gray-900 tracking-tight">
              ¥{restaurant.restaurant_price || '---'}
            </span>
            <span className="text-xs font-bold text-orange-500 group-hover:translate-x-1 transition-transform">
              {t('btn_details', '詳細を見る')} →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}