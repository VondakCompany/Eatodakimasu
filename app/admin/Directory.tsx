// Directory.tsx
'use client';
import { useState } from 'react';
import { RestaurantCard, Icons } from './shared';

export default function Directory({ 
  restaurants, 
  onEdit, 
  onStatusUpdate, 
  onDelete 
}: { 
  restaurants: any[], 
  onEdit: (r: any) => void, 
  onStatusUpdate: (r: any, s: string) => void, 
  onDelete: (id: string, title: string) => void 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredRestaurants = restaurants.filter(rest => {
    if (!searchQuery.trim()) return true;
    return rest.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div>
      <div className="mb-8">
        <div className="relative shadow-sm rounded-3xl bg-white border border-gray-200 max-w-2xl">
          <Icons.Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by restaurant name..."
            className="w-full pl-14 pr-12 py-4 bg-transparent rounded-3xl outline-none font-bold text-gray-800 text-lg focus:ring-2 focus:ring-orange-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      {filteredRestaurants.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold">No restaurants found matching "{searchQuery}"</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredRestaurants.map(restaurant => (
            <RestaurantCard 
              key={restaurant.id} 
              restaurant={restaurant} 
              tab="directory"
              onEdit={onEdit}
              onStatusUpdate={onStatusUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}