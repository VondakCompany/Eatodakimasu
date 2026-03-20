'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function RestaurantCard({ restaurant }: { restaurant: any }) {
  // Use state to handle the image safely
  const [imgSrc, setImgSrc] = useState(restaurant.image_url || '/images/default.jpg');

  // Update it if the search filters change and load new restaurants
  useEffect(() => {
    setImgSrc(restaurant.image_url || '/images/default.jpg');
  }, [restaurant.image_url]);

  return (
    <Link 
      href={`/restaurant/${restaurant.id}`} 
      className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    >
      <div className="h-48 bg-gray-200 relative overflow-hidden">
        
        <img 
          src={imgSrc} 
          alt={restaurant.title} 
          onError={() => setImgSrc('/images/default.jpg')} // Fallback if image breaks
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {restaurant.takeout_available && (
            <span className="bg-orange-600 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-sm">
              🛍️ テイクアウト
            </span>
          )}
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-black text-gray-900 line-clamp-1">{restaurant.title}</h3>
        </div>
        
        {restaurant.cuisine && (
          <p className="text-sm font-bold text-orange-600 mb-3">{restaurant.cuisine.join(' • ')}</p>
        )}
        
        {/* Dietary Tags */}
        {restaurant.food_restrictions && restaurant.food_restrictions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {restaurant.food_restrictions.map((res: string) => (
              <span key={res} className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded-md">
                {res}
              </span>
            ))}
          </div>
        )}
        
        {/* Footer info */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-sm font-bold text-gray-500">
          <span className="flex items-center">
            <span className="mr-1 text-lg">📍</span> 
            {restaurant.restaurant_area && restaurant.restaurant_area.length > 0 
              ? restaurant.restaurant_area[0] 
              : '早稲田周辺'}
          </span>
          {restaurant.restaurant_price && (
            <span>¥{restaurant.restaurant_price}〜</span>
          )}
        </div>
      </div>
    </Link>
  );
}