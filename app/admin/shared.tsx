'use client';
import { supabase } from '@/lib/supabaseClient';

// Clean, professional SVG icons (Heroicons outline style)
export const Icons = {
  Directory: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>,
  Pending: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Categories: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /></svg>,
  Translations: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
  AdStudio: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>,
  Users: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  Registration: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  Admin: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  Editor: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
  Search: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  Lock: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
  MapPin: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  Mail: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>,
  Edit: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>,
  Close: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Sync: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
};

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
      {restaurant.lat && (
        <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-black flex items-center gap-1">
          <Icons.MapPin className="w-3 h-3" /> GEO
        </span>
      )}
    </div>
    <p className="text-xs text-orange-500 font-bold mb-4">¥{restaurant.restaurant_price || '---'}</p>

    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-5 space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
        <Icons.Lock className="w-3 h-3" /> Private Contact
      </p>
      <p className="text-xs font-bold text-slate-700 flex justify-between"><span className="text-slate-400">担当者:</span> {restaurant.contact_name || '未設定'}</p>
      <p className="text-xs font-bold text-slate-700 flex justify-between"><span className="text-slate-400">電話:</span> {restaurant.contact_phone || '未設定'}</p>
      <p className="text-xs font-bold text-slate-700 flex justify-between truncate gap-2"><span className="text-slate-400 shrink-0">メール:</span> {restaurant.contact_email || '未設定'}</p>
    </div>

    <div className="flex gap-2 mt-auto">
      <button onClick={() => onEdit(restaurant)} className="flex-1 bg-gray-900 text-white text-xs font-black py-3 rounded-xl hover:bg-black transition flex items-center justify-center gap-1.5">
        <Icons.Edit className="w-3.5 h-3.5" /> Edit
      </button>
      {tab === 'directory' ? (
        <button onClick={() => onStatusUpdate(restaurant, 'pending')} className="flex-1 bg-gray-100 text-gray-600 text-xs font-black py-3 rounded-xl hover:bg-gray-200 transition">Unpublish</button>
      ) : (
        <button onClick={() => onStatusUpdate(restaurant, 'approved')} className="flex-1 bg-green-600 text-white text-xs font-black py-3 rounded-xl hover:bg-green-700 transition">Approve</button>
      )}
      <button onClick={() => onDelete(restaurant.id, restaurant.title)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition flex items-center justify-center">
        <Icons.Close className="w-4 h-4" />
      </button>
    </div>
  </div>
);