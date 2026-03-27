'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RestaurantCard({ 
  restaurant, 
  activeEvents = [],
  userLocation 
}: { 
  restaurant: any, 
  activeEvents?: any[],
  userLocation?: { lat: number, lng: number } | null 
}) {
  const { currentLang, t } = useLanguage();

  const displayTitle = currentLang === 'ja' 
    ? restaurant.title 
    : (restaurant.translations?.[currentLang]?.title || restaurant.title);
    
  const displayDescription = currentLang === 'ja' 
    ? restaurant.description 
    : (restaurant.translations?.[currentLang]?.description || restaurant.description);

  // ✅ SAFELY CALCULATE DISTANCE LOCALLY
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
  };

  // Prioritize pre-calculated distance, fallback to local math if location exists
  let finalDistance = restaurant.dist_meters;
  if (finalDistance === undefined && userLocation && restaurant.lat && restaurant.lng) {
    finalDistance = calculateDistance(userLocation.lat, userLocation.lng, restaurant.lat, restaurant.lng);
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block group h-full">
      <div className="bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full flex flex-col relative transform group-hover:-translate-y-1">
        
        {/* ✅ DISTANCE BADGE */}
        {finalDistance !== undefined && finalDistance !== null && !isNaN(finalDistance) && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg flex items-center gap-1.5 z-10 border border-gray-100/50">
            <span className="text-orange-500 text-sm">📍</span>
            <span className="font-black text-gray-900 text-sm tracking-tight">{formatDistance(finalDistance)}</span>
          </div>
        )}

        {/* IMAGE CONTAINER */}
        <div className="relative h-56 w-full bg-gray-100 overflow-hidden">
          <img 
            src={restaurant.image_url || '/images/default.jpg'} 
            alt={displayTitle} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {restaurant.participates_in_event && (
             <div className="absolute bottom-4 left-4 bg-pink-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">
               Event
             </div>
          )}
        </div>

        {/* TEXT CONTENT */}
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

        {/* EVENT BADGE STRIP */}
        {restaurant.other_options && restaurant.other_options.length > 0 && activeEvents && (
          <div className="bg-purple-50 px-6 py-3 border-t border-purple-100">
            <div className="flex flex-wrap gap-2">
              {restaurant.other_options.map((catName: string) => {
                const isConstant = activeEvents.find(e => e.name === catName)?.is_constant;
                return (
                  <span key={catName} className={`text-[10px] font-black px-2 py-1 rounded-md ${isConstant ? 'bg-slate-200 text-slate-700' : 'bg-purple-200 text-purple-800'}`}>
                    🎉 {t(`tag_${catName}`, catName)}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}