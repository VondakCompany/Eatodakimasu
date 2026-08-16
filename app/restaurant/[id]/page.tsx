// app/restaurant/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];

export default function RestaurantPage({ params }: { params: { id: string } }) {
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', params.id)
          .single();

        if (fetchError) throw fetchError;
        setRestaurant(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load restaurant details.');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchRestaurant();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-orange-500"></div>
          <p className="text-gray-400 font-bold tracking-widest text-sm uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Shop Not Found</h1>
        <p className="text-gray-500 font-medium mb-8 max-w-md">{error || "We couldn't find the restaurant you're looking for. It may have been removed or unpublished."}</p>
        <Link href="/" className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition shadow-lg">
          Return Home
        </Link>
      </div>
    );
  }

  let parsedHours: Record<string, string> = {};
  try {
    if (typeof restaurant.operating_hours === 'string' && restaurant.operating_hours.startsWith('{')) {
      parsedHours = JSON.parse(restaurant.operating_hours);
    } else if (typeof restaurant.operating_hours === 'object') {
      parsedHours = restaurant.operating_hours;
    }
  } catch (e) {}

  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-in fade-in duration-500">
      
      {/* --- HERO SECTION --- */}
      <div className="w-full h-[40vh] md:h-[50vh] bg-gray-200 relative">
        {restaurant.image_url ? (
          <img src={restaurant.image_url} alt={restaurant.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200">
            <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span className="font-black tracking-widest uppercase text-xs">No Photo</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        
        <div className="absolute top-6 left-6 z-10">
          <Link href="/" className="bg-white/20 backdrop-blur-md hover:bg-white/40 border border-white/30 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition">
             ← Back
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-4">
            {restaurant.restaurant_area && restaurant.restaurant_area.map((area: string, idx: number) => (
              <span key={idx} className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">{area}</span>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">{restaurant.title}</h1>
          <p className="text-orange-400 font-black text-xl flex items-center gap-2">
            ¥{restaurant.restaurant_price || '---'} 
            <span className="text-gray-300 font-medium text-sm">avg. per person</span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        
        {/* --- MAIN CONTENT (LEFT COLUMN) --- */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="flex flex-wrap gap-2">
            {['cuisine', 'food_restrictions', 'other_options'].map((field) => (
              (restaurant[field] || []).map((tag: string, idx: number) => (
                <span key={`${field}-${idx}`} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-700 shadow-sm">
                  {tag}
                </span>
              ))
            ))}
          </div>

          {restaurant.description && (
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">About the Shop</h2>
              <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{restaurant.description}</p>
            </section>
          )}

          {/* --- NEW MENU DETAILS TABLE --- */}
          {restaurant.menu_items && restaurant.menu_items.length > 0 && (
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">📖 詳細メニュー (Menu Details)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="pb-3 text-sm font-black text-gray-400 w-1/3">メニュー名 (Item)</th>
                      <th className="pb-3 text-sm font-black text-gray-400">説明 (Description)</th>
                      <th className="pb-3 text-sm font-black text-gray-400 text-right w-24">価格 (Price)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {restaurant.menu_items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 pr-4 font-black text-gray-900 align-top">{item.name}</td>
                        <td className="py-4 pr-4 text-sm font-medium text-gray-600 align-top">{item.description || '-'}</td>
                        <td className="py-4 font-black text-orange-600 text-right align-top whitespace-nowrap">¥{item.price || '---'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {restaurant.takeout_menu && (
            <section className="bg-orange-50 p-8 rounded-[32px] shadow-sm border border-orange-100">
              <h2 className="text-xl font-black text-orange-900 mb-4 flex items-center gap-2">
                🥡 Takeout Available
              </h2>
              <p className="text-orange-800 font-medium leading-relaxed whitespace-pre-wrap">{restaurant.takeout_menu}</p>
            </section>
          )}
          
          {restaurant.image_urls && restaurant.image_urls.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-black text-gray-900 px-2">Gallery</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {restaurant.image_urls.map((url: string, idx: number) => (
                  <div key={idx} className="aspect-square bg-gray-200 rounded-[24px] overflow-hidden border border-gray-100 shadow-sm">
                    <img src={url} alt={`Gallery image ${idx + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500 cursor-pointer" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* --- SIDEBAR INFO (RIGHT COLUMN) --- */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-8 sticky top-8">
            
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Location</h3>
              <p className="text-gray-900 font-bold text-sm leading-relaxed">{restaurant.address || 'Address not provided'}</p>
              
              {restaurant.lat && restaurant.lng && (
                 <a href={`https://www.google.com/maps/search/?api=1&query=${restaurant.lat},${restaurant.lng}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black text-gray-700 transition">
                   Open in Google Maps
                 </a>
              )}
              
              {restaurant.website_url && (
                <a href={restaurant.website_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center w-full py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-xs font-black text-blue-600 transition">
                  Visit Official Website
                </a>
              )}
            </div>

            <hr className="border-gray-100" />

            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Operating Hours</h3>
              {typeof parsedHours === 'object' && Object.keys(parsedHours).length > 0 ? (
                <div className="space-y-3">
                  {DAYS.map(day => (
                    parsedHours[day] ? (
                      <div key={day} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-500 text-xs">{day}</span>
                        <span className="font-black text-gray-900">{parsedHours[day]}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              ) : (
                <p className="text-gray-900 font-black text-sm whitespace-pre-wrap">{typeof restaurant.operating_hours === 'string' ? restaurant.operating_hours : 'Hours not provided'}</p>
              )}
            </div>

            <hr className="border-gray-100" />

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Seats</h3>
                <p className="font-black text-base text-gray-900">{restaurant.total_seats || '---'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg Stay</h3>
                <p className="font-black text-base text-gray-900">{restaurant.avg_stay_time || '---'}</p>
              </div>
            </div>

            {restaurant.payment_methods && restaurant.payment_methods.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Accepted Payments</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.payment_methods.map((method: string, idx: number) => (
                    <span key={idx} className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">{method}</span>
                  ))}
                </div>
              </div>
            )}
            
            {restaurant.discount_info && (
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
                <h3 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  ⭐ Special Offers
                </h3>
                <p className="text-sm font-bold text-yellow-900">{restaurant.discount_info}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}