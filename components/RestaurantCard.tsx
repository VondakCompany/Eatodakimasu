import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RestaurantCard({ restaurant }: { restaurant: any }) {
  const { currentLang, t } = useLanguage();

  const displayTitle = currentLang === 'ja' 
    ? restaurant.title 
    : (restaurant.translations?.[currentLang]?.title || restaurant.title);
    
  const displayDescription = currentLang === 'ja' 
    ? restaurant.description 
    : (restaurant.translations?.[currentLang]?.description || restaurant.description);

  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group shadow-sm flex flex-col h-full">
      <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
        <img 
          src={restaurant.image_url || "/images/default.jpg"} 
          alt={displayTitle} 
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
        />
        {restaurant.participates_in_event && (
          <span className="absolute top-4 right-4 bg-pink-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-md">
            {t('badge_event_short', '🎉 イベント')}
          </span>
        )}
        {restaurant.takeout_available && (
          <span className="absolute top-4 left-4 bg-white/90 backdrop-blur text-orange-600 text-xs font-black px-3 py-1 rounded-full shadow-sm">
            {t('badge_takeout_short', '🛍️ テイクアウト')}
          </span>
        )}
      </div>
      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2 gap-4">
          <h3 className="text-xl font-black text-gray-900 group-hover:text-orange-600 transition leading-tight line-clamp-2">
            {displayTitle}
          </h3>
          {restaurant.restaurant_price && (
            <span className="bg-orange-50 text-orange-700 text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap">
              ¥{restaurant.restaurant_price}〜
            </span>
          )}
        </div>
        
        {restaurant.cuisine && restaurant.cuisine.length > 0 && (
          <p className="text-sm font-bold text-orange-500 mb-3">
            {restaurant.cuisine.map((c: string) => t(`tag_${c}`, c)).join(' • ')}
          </p>
        )}
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 font-medium flex-1">
          {displayDescription}
        </p>
        
        <div className="flex flex-wrap gap-2 mt-auto">
          {restaurant.food_restrictions && restaurant.food_restrictions.slice(0, 3).map((res: string, i: number) => (
            <span key={i} className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">
              {t(`tag_${res}`, res)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}