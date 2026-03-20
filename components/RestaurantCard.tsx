'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RestaurantCard({ restaurant }: { restaurant: any }) {
  // Looks for an image named exactly after the restaurant title
  const [imgSrc, setImgSrc] = useState(`/images/${restaurant.title}.jpg`);

  return (
    <Link href={`/restaurant/${restaurant.id}`} className="group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl transition-all flex flex-col overflow-hidden">
      
      {/* Image Header */}
      <div className="h-48 w-full overflow-hidden relative bg-gray-100">
        <img 
          src={imgSrc} 
          alt={restaurant.title}
          onError={() => setImgSrc('/images/default.jpg')} // Fallback if the specific file isn't found
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        />
        {restaurant.restaurant_price && (
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm text-orange-900 text-xs font-black px-3 py-1.5 rounded-full shadow-sm border border-orange-100">
            ¥{restaurant.restaurant_price}〜
          </div>
        )}
      </div>

      <div className="p-5 flex-grow">
        <h2 className="text-xl font-black text-gray-900 leading-tight mb-3 group-hover:text-orange-600 transition-colors">
          {restaurant.title}
        </h2>
        
        <div className="space-y-1.5 text-sm text-gray-600">
          {restaurant.cuisine && restaurant.cuisine.length > 0 && (
             <p><span className="font-bold text-gray-400 text-xs uppercase tracking-wider">ジャンル:</span> {restaurant.cuisine.join('、 ')}</p>
          )}
          {restaurant.restaurant_area && restaurant.restaurant_area.length > 0 && (
             <p><span className="font-bold text-gray-400 text-xs uppercase tracking-wider">エリア:</span> {restaurant.restaurant_area.join('、 ')}</p>
          )}
        </div>

        {restaurant.takeout_available && (
          <div className="mt-4 inline-flex items-center px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-md border border-orange-100">
             🛍️ テイクアウト可
          </div>
        )}
      </div>
      
      {restaurant.food_restrictions && restaurant.food_restrictions.length > 0 && (
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2">
          {restaurant.food_restrictions.map((restriction: string, i: number) => (
            <span key={i} className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
              {restriction}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}