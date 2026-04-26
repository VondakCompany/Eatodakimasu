// /components/RestaurantDirectory.tsx

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RestaurantCard from './RestaurantCard';
import { getDbField } from '@/app/admin/shared'; // RESTORED IMPORT

export default function RestaurantDirectory({ initialRestaurants }: { initialRestaurants: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // This state holds the selections for ALL dynamic tags
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [masterFilters, setMasterFilters] = useState<any[]>([]);

  // FETCH DYNAMIC FILTERS FROM DATABASE
  useEffect(() => {
    supabase.from('filter_options')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setMasterFilters(data);
      });
  }, []);

  const filterTypes = Array.from(new Set(masterFilters.map(f => f.type)));

  const handleFilterChange = (type: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [type]: value }));
  };

  const handleReset = () => {
    setSearchQuery('');
    setActiveFilters({});
  };

  // BULLETPROOF CLIENT-SIDE FILTERING
  const filteredRestaurants = initialRestaurants.filter((restaurant) => {
    
    // 1. Text Search
    const textMatch = !searchQuery || 
      restaurant.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      restaurant.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (restaurant.cuisine && restaurant.cuisine.includes(searchQuery));

    // 2. Dynamic Database Filters Match
    let dynamicMatch = true;
    Object.entries(activeFilters).forEach(([type, filterValue]) => {
      if (filterValue === '') return; // Skip unselected dropdowns
      
      // Use your shared function to map the filter type to the actual column name
      const dbColumnName = getDbField(type);
      const dbValue = restaurant[dbColumnName];

      // --- SPECIAL LOGIC FOR SEATS ---
      if (type === 'seats') {
        const rawSeats = (dbValue || '').toString();
        // Extract all numbers from strings like "店内50席、テラス20席" and sum them up
        const numbers = rawSeats.match(/\d+/g);
        const seatNumber = numbers ? numbers.reduce((sum: number, num: string) => sum + parseInt(num, 10), 0) : 0;
        
        let matchesSeat = false;
        if (filterValue === '1-10 席' && seatNumber >= 1 && seatNumber <= 10) matchesSeat = true;
        else if (filterValue === '11-30 席' && seatNumber >= 11 && seatNumber <= 30) matchesSeat = true;
        else if (filterValue === '31 席以上' && seatNumber >= 31) matchesSeat = true;
        
        if (!matchesSeat) dynamicMatch = false;
        return; 
      }

      // --- STANDARD LOGIC FOR EVERYTHING ELSE ---
      // Normalize both arrays and stringified arrays into a simple, searchable string
      const safeDbString = typeof dbValue === 'string' 
        ? dbValue 
        : Array.isArray(dbValue) ? JSON.stringify(dbValue) : '';

      if (!safeDbString.includes(filterValue)) {
        dynamicMatch = false;
      }
    });

    return textMatch && dynamicMatch;
  });

  const hasActiveFilters = searchQuery !== '' || Object.values(activeFilters).some(v => v !== '');

  return (
    <div className="space-y-8">
      {/* Search and Filter Bar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row flex-wrap gap-4">
        
        {/* Text Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">キーワード検索</label>
          <input 
            type="text" 
            placeholder="レストラン名、キーワード等"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition"
          />
        </div>

        {/* Dynamically Generated Database Dropdowns */}
        {filterTypes.map(type => {
          const options = masterFilters.filter(f => f.type === type);
          if (options.length === 0) return null;

          // Format the label neatly for the UI (Translates common keys, otherwise capitalizes the new key)
          const label = type === 'restriction' ? '食の制限' :
                        type === 'campus' ? 'エリア' :
                        type === 'cuisine' ? 'ジャンル' :
                        type === 'payment' ? '決済方法' : 
                        type === 'seats' ? '席数' :
                        type === 'discount_type' ? '割引タイプ' :
                        type === 'other' ? 'その他' : 
                        type.charAt(0).toUpperCase() + type.slice(1); // Fallback for new CategoriesHub columns

          return (
            <div key={type} className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
              <select 
                value={activeFilters[type] || ''}
                onChange={(e) => handleFilterChange(type, e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition cursor-pointer appearance-none"
              >
                <option value="">すべて</option>
                {options.map(opt => (
                  <option key={opt.id} value={opt.name}>{opt.name}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Dynamic Results Count */}
      <div className="flex justify-between items-center px-2">
        <p className="text-gray-600 font-medium">
          検索結果: <span className="font-bold text-gray-900">{filteredRestaurants.length}</span>件
        </p>
        
        {hasActiveFilters && (
          <button 
            onClick={handleReset}
            className="text-sm font-bold text-red-600 hover:text-red-800 transition bg-red-50 px-3 py-1.5 rounded-lg"
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