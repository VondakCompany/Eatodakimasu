'use client';

import { useState } from 'react';
import RestaurantCard from './RestaurantCard';

export default function RestaurantDirectory({ initialRestaurants }: { initialRestaurants: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRestriction, setFilterRestriction] = useState('');
  const [filterArea, setFilterArea] = useState('');

  // Extract unique filter options from the dataset
  const allRestrictions = Array.from(new Set(initialRestaurants.flatMap(r => r.food_restrictions || [])));
  const allAreas = Array.from(new Set(initialRestaurants.flatMap(r => r.restaurant_area || [])));

  // Real-time filtering logic
  const filteredRestaurants = initialRestaurants.filter((restaurant) => {
    // 1. Text Search (Title or Description)
    const textMatch = 
      restaurant.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      restaurant.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.cuisine?.join(' ').toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Dropdown Filters
    const restrictionMatch = filterRestriction === '' || (restaurant.food_restrictions && restaurant.food_restrictions.includes(filterRestriction));
    const areaMatch = filterArea === '' || (restaurant.restaurant_area && restaurant.restaurant_area.includes(filterArea));

    return textMatch && restrictionMatch && areaMatch;
  });

  return (
    <div className="space-y-8">
      {/* Search and Filter Bar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        
        {/* Text Search */}
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">キーワード検索</label>
          <input 
            type="text" 
            placeholder="レストラン名、キーワード、ジャンル等"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition"
          />
        </div>

        {/* Filters */}
        <div className="flex-1 md:w-1/4">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">エリア</label>
          <select 
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition cursor-pointer appearance-none"
          >
            <option value="">すべて</option>
            {allAreas.map(area => (
              <option key={area as string} value={area as string}>{area as string}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 md:w-1/4">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">食の制限</label>
          <select 
            value={filterRestriction}
            onChange={(e) => setFilterRestriction(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition cursor-pointer appearance-none"
          >
            <option value="">すべて</option>
            {allRestrictions.map(res => (
              <option key={res as string} value={res as string}>{res as string}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Results Count */}
      <div className="flex justify-between items-center px-2">
        <p className="text-gray-600 font-medium">
          検索結果: <span className="font-bold text-gray-900">{filteredRestaurants.length}</span>件
        </p>
        
        {(searchQuery || filterRestriction || filterArea) && (
          <button 
            onClick={() => { setSearchQuery(''); setFilterRestriction(''); setFilterArea(''); }}
            className="text-sm font-bold text-red-600 hover:text-red-800 transition"
          >
            リセット
          </button>
        )}
      </div>

      {/* Grid of Results */}
      {filteredRestaurants.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-xl text-gray-500 font-semibold">条件に一致するレストランが見つかりません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      )}
    </div>
  );
}