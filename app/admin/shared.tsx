'use client';
import { supabase } from '@/lib/supabaseClient';

export const geocodeAddress = async (address: string) => {
  if (!address) return { lat: null, lng: null };
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      alert("Google Maps API Key is missing! Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local");
      return { lat: null, lng: null };
    }
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return { lat: null, lng: null };
};

export const getDbField = (type: string) => {
  switch (type) {
    case 'cuisine': return 'cuisine';
    case 'restriction': return 'food_restrictions';
    case 'payment': return 'payment_methods';
    case 'area': return 'restaurant_area';
    default: return type;
  }
};

export const RestaurantCard = ({ 
  restaurant, 
  tab, 
  onEdit, 
  onStatusUpdate, 
  onDelete 
}: { 
  restaurant: any, 
  tab: 'directory' | 'pending', 
  onEdit: (r: any) => void, 
  onStatusUpdate: (r: any, s: string) => void, 
  onDelete: (id: string, title: string) => void 
}) => (
  <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-200 flex flex-col hover:shadow-xl transition-all duration-300">
    {restaurant.image_url ? (
      <img src={restaurant.image_url} alt="Cover" className="w-full h-40 object-cover rounded-2xl mb-5 bg-gray-50" />
    ) : (
      <div className="w-full h-40 bg-gray-100 rounded-2xl mb-5 flex items-center justify-center text-gray-300 text-xs font-black">NO PHOTO</div>
    )}
    
    <div className="flex justify-between items-start mb-1">
      <h3 className="text-xl font-black text-gray-900 truncate flex-1">{restaurant.title}</h3>
      {restaurant.lat && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-black">📍 GEO</span>}
    </div>
    <p className="text-xs text-orange-500 font-bold mb-4">¥{restaurant.restaurant_price || '---'}</p>

    {/* --- NEW: QUICK GLANCE PRIVATE INFO --- */}
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-5 space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">🔒 Private Contact</p>
      <p className="text-xs font-bold text-slate-700 flex justify-between"><span className="text-slate-400">担当者:</span> {restaurant.contact_name || '未設定'}</p>
      <p className="text-xs font-bold text-slate-700 flex justify-between"><span className="text-slate-400">電話:</span> {restaurant.contact_phone || '未設定'}</p>
      <p className="text-xs font-bold text-slate-700 flex justify-between truncate gap-2"><span className="text-slate-400 shrink-0">メール:</span> {restaurant.contact_email || '未設定'}</p>
    </div>
    {/* -------------------------------------- */}

    <div className="flex gap-2 mt-auto">
      <button onClick={() => onEdit(restaurant)} className="flex-1 bg-gray-900 text-white text-xs font-black py-3 rounded-xl hover:bg-black transition">✏️ Edit</button>
      {tab === 'directory' ? (
        <button onClick={() => onStatusUpdate(restaurant, 'pending')} className="flex-1 bg-gray-100 text-gray-600 text-xs font-black py-3 rounded-xl hover:bg-gray-200 transition">Unpublish</button>
      ) : (
        <button onClick={() => onStatusUpdate(restaurant, 'approved')} className="flex-1 bg-green-600 text-white text-xs font-black py-3 rounded-xl hover:bg-green-700 transition">Approve</button>
      )}
      <button onClick={() => onDelete(restaurant.id, restaurant.title)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">✕</button>
    </div>
  </div>
);