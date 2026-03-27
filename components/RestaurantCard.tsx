'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

type RestaurantCardProps = {
  restaurant: any;
  activeEvents?: any[];
};

export default function RestaurantCard({ restaurant, activeEvents = [] }: RestaurantCardProps) {
  const { t, currentLang } = useLanguage();

  // Let the CMS toggle rule: only show events that specifically have show_badge toggled ON
  const badgeEvents = activeEvents.filter(event => 
    event.show_badge === true && (restaurant.other_options || []).includes(event.name)
  );

  return (
    <Link 
      href={`/restaurant/${restaurant.id}`} 
      className="group block bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
    >
      <div className="relative h-48 md:h-56 bg-gray-100 overflow-hidden">
        {restaurant.image_url ? (
          <img 
            src={restaurant.image_url} 
            alt={restaurant.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 font-black text-sm bg-gray-50">
            NO PHOTO
          </div>
        )}

        {/* 🏆 TOP LEFT BADGES (Takeout & Events) */}
        {(restaurant.takeout_available || badgeEvents.length > 0) && (
          <div className="absolute top-4 left-4 flex flex-col items-start gap-2 z-10">
            
            {/* 🛍️ ORIGINAL TAKEOUT BADGE */}
            {restaurant.takeout_available && (
              <span className="bg-white/90 backdrop-blur text-orange-600 text-xs font-black px-3 py-1 rounded-full shadow-sm">
                {t('badge_takeout_short', '🛍️ テイクアウト')}
              </span>
            )}

            {/* ⏰ & 📌 DYNAMIC EVENT BADGES */}
            {badgeEvents.map(event => {
              const translatedName = currentLang === 'ja' 
                ? event.name 
                : (event.translations?.[currentLang]?.name || event.name);
              
              // ✅ CONSTANT EVENT BADGE (Neutral, permanent style)
              if (event.is_constant) {
                return (
                  <span 
                    key={event.id} 
                    className="bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-md uppercase tracking-wider border border-slate-700"
                  >
                    📌 {translatedName}
                  </span>
                );
              }

              // ⏰ SEASONAL EVENT BADGE (Popping, urgent style)
              return (
                <span 
                  key={event.id} 
                  className="bg-purple-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-md uppercase tracking-wider border border-purple-400"
                >
                  ⏰ {t('badge_limited_time', '期間限定')}: {translatedName}
                </span>
              );
            })}
          </div>
        )}

        {/* PRICE BADGE */}
        {restaurant.restaurant_price && (
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-gray-900 font-black px-3 py-1.5 rounded-xl shadow-sm text-sm">
            ¥{restaurant.restaurant_price}〜
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col h-full">
        <h3 className="text-xl font-black text-gray-900 mb-2 truncate group-hover:text-orange-600 transition">
          {restaurant.title}
        </h3>

        {/* CUISINE TAGS */}
        {restaurant.cuisine && restaurant.cuisine.length > 0 && (
          <p className="text-sm text-gray-500 font-bold mb-4 truncate">
            {restaurant.cuisine.join(' • ')}
          </p>
        )}

        {/* DIETARY TAGS */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {(restaurant.food_restrictions || []).slice(0, 3).map((res: string) => (
            <span 
              key={res} 
              className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md border border-green-100 whitespace-nowrap"
            >
              {res}
            </span>
          ))}
          {(restaurant.food_restrictions || []).length > 3 && (
            <span className="text-gray-400 text-[10px] font-bold py-1">...</span>
          )}
        </div>
      </div>
    </Link>
  );
}