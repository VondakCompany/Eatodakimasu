'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

const getArrayParam = (param: string | null) => param ? param.split(',') : [];

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [price, setPrice] = useState(searchParams.get('price') || '3000');
  const [takeout, setTakeout] = useState(searchParams.get('takeout') === 'true');
  
  const [cuisines, setCuisines] = useState<string[]>(getArrayParam(searchParams.get('cuisine')));
  const [areas, setAreas] = useState<string[]>(getArrayParam(searchParams.get('area')));
  const [restrictions, setRestrictions] = useState<string[]>(getArrayParam(searchParams.get('restriction')));

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, array: string[], value: string) => {
    if (array.includes(value)) {
      setter(array.filter(item => item !== value));
    } else {
      setter([...array, value]);
    }
  };

  // DEBOUNCED EFFECT: Waits 350ms after you stop changing things before updating the URL
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (price && price !== '3000') params.set('price', price);
      if (cuisines.length) params.set('cuisine', cuisines.join(','));
      if (areas.length) params.set('area', areas.join(','));
      if (restrictions.length) params.set('restriction', restrictions.join(','));
      if (takeout) params.set('takeout', 'true');
      
      // scroll: false prevents the page from jumping to the top on every click
      router.push(`/?${params.toString()}`, { scroll: false });
    }, 350);

    // Cleanup function cancels the previous timer if you click/type again before 350ms
    return () => clearTimeout(delayDebounceFn);
  }, [query, price, cuisines, areas, restrictions, takeout, router]);

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 mb-10">
      
      <div className="mb-8">
        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">キーワード (Keyword)</label>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="レストラン名、メニュー、キーワード..." 
          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition text-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">ジャンル (Cuisine)</label>
          <div className="space-y-2.5">
            {['和食', '洋食', '中華', 'アジア'].map((c) => (
              <label key={c} className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={cuisines.includes(c)}
                  onChange={() => toggleArrayItem(setCuisines, cuisines, c)}
                  className="h-5 w-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer" 
                />
                <span className="ml-3 text-sm font-medium text-gray-700 group-hover:text-orange-600 transition">{c}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">エリア (Area)</label>
          <div className="space-y-2.5">
            {['wasemeshi', '高田馬場', '早稲田'].map((a) => (
              <label key={a} className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={areas.includes(a)}
                  onChange={() => toggleArrayItem(setAreas, areas, a)}
                  className="h-5 w-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer" 
                />
                <span className="ml-3 text-sm font-medium text-gray-700 group-hover:text-orange-600 transition">{a}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">食事制限 (Dietary)</label>
          <div className="space-y-2.5">
            {['ハラール', 'ヴィーガン', 'ベジタリアン'].map((r) => (
              <label key={r} className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={restrictions.includes(r)}
                  onChange={() => toggleArrayItem(setRestrictions, restrictions, r)}
                  className="h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer" 
                />
                <span className="ml-3 text-sm font-bold text-gray-700 group-hover:text-green-700 transition">{r}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100">
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">予算 (Max Price)</label>
            <span className="text-orange-600 font-bold text-sm">
              {price === '3000' ? '上限なし (No limit)' : `¥${price} 以下`}
            </span>
          </div>
          <input 
            type="range" 
            min="500" 
            max="3000" 
            step="100"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
          />
        </div>

        <div className="flex items-center justify-start md:justify-end">
          <label className="flex items-center cursor-pointer bg-orange-50 px-5 py-3 rounded-xl border border-orange-100 hover:bg-orange-100 transition shadow-sm">
            <input 
              type="checkbox" 
              checked={takeout}
              onChange={(e) => setTakeout(e.target.checked)}
              className="h-5 w-5 text-orange-600 rounded border-gray-300 cursor-pointer focus:ring-orange-500" 
            />
            <span className="ml-3 font-black text-orange-900 text-sm">🛍️ テイクアウトのみ (Takeout Only)</span>
          </label>
        </div>

      </div>
    </div>
  );
}