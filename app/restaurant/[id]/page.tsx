import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClientImage from './ClientImage';

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();

  if (error || !restaurant) {
    notFound(); 
  }

  // FIXED: Standard Google Maps Embed URL
  const mapEmbedUrl = restaurant.address 
    ? `https://maps.google.com/maps?q=${encodeURIComponent(restaurant.address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    : null;

  // FIXED: Standard Google Maps Outbound Link
  const mapOutboundLink = restaurant.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(restaurant.address)}`
    : null;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mt-4 md:mt-8 mb-20">
      
      {/* Header Banner & Image */}
      <div className="h-64 md:h-96 w-full relative bg-gray-900 group">
        <ClientImage title={restaurant.title} />
        <Link href="/" className="absolute top-6 left-6 bg-white/90 backdrop-blur text-gray-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-white transition shadow-sm z-10">
          ← 検索に戻る (Back)
        </Link>
      </div>

      <div className="p-8 md:p-12">
        
        {/* Title & Price */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-100 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2">{restaurant.title}</h1>
            {restaurant.cuisine && (
              <p className="text-orange-600 font-bold">{restaurant.cuisine.join(' • ')}</p>
            )}
          </div>
          {restaurant.restaurant_price && (
            <span className="bg-orange-50 text-orange-800 text-lg font-black px-6 py-3 rounded-2xl border border-orange-100 whitespace-nowrap shadow-sm">
              目安: ¥{restaurant.restaurant_price}〜
            </span>
          )}
        </div>

        {/* Description */}
        {restaurant.description && (
          <p className="text-lg text-gray-700 mb-12 leading-relaxed">{restaurant.description}</p>
        )}

        {/* FULLY FLEDGED MENU SECTION */}
        <div className="mb-12">
          <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center">
            <span className="text-3xl mr-3">📋</span> メニュー (Menu)
          </h2>
          <div className="bg-gray-50 p-6 md:p-8 rounded-3xl border border-gray-100">
            {restaurant.full_menu ? (
              <div className="text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">
                {restaurant.full_menu}
              </div>
            ) : (
              <p className="text-gray-500 italic">メニューの詳細は現在準備中です。(Menu details coming soon)</p>
            )}

            {restaurant.takeout_available && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-black text-orange-900 uppercase tracking-wider mb-3 flex items-center">
                  🛍️ テイクアウトメニュー (Takeout)
                </h3>
                <p className="text-gray-800 font-medium">{restaurant.takeout_menu || 'テイクアウト対応あり (Takeout available)'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5">店舗情報 (Info)</h3>
            <ul className="space-y-4 text-gray-800 font-medium">
              {restaurant.restaurant_area && restaurant.restaurant_area.length > 0 && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">🗺️</span> {restaurant.restaurant_area.join('、 ')}</li>}
              {restaurant.total_seats && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">🪑</span> 座席数: {restaurant.total_seats}</li>}
              {restaurant.avg_stay_time && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">⏳</span> 滞在時間: {restaurant.avg_stay_time}</li>}
              {restaurant.payment_methods && restaurant.payment_methods.length > 0 && <li className="flex items-start"><span className="w-6 text-xl mr-3 text-center">💳</span> {restaurant.payment_methods.join('、 ')}</li>}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5">食事制限 (Dietary)</h3>
             {restaurant.food_restrictions && restaurant.food_restrictions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {restaurant.food_restrictions.map((res: string, i: number) => (
                    <span key={i} className="bg-green-100 text-green-800 text-sm font-bold px-4 py-2 rounded-xl border border-green-200">
                      {res}
                    </span>
                  ))}
                </div>
             ) : (
               <p className="text-gray-500 font-medium">特別な対応表記なし</p>
             )}
          </div>
        </div>
      </div>

      {/* INTERACTIVE MAP & ADDRESS FALLBACK SECTION */}
      {restaurant.address && (
        <div className="bg-gray-50 border-t border-gray-200 p-8 md:p-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">アクセス (Location)</h2>
              <p className="text-gray-800 font-bold text-lg flex items-start">
                <span className="mr-2">📍</span> {restaurant.address}
              </p>
            </div>
            
            <a 
              href={mapOutboundLink || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800 transition shadow-md whitespace-nowrap"
            >
              マップアプリで開く ↗
            </a>
          </div>

          {/* The Embed Map */}
          {mapEmbedUrl && (
            <div className="w-full h-80 md:h-96 rounded-3xl overflow-hidden border border-gray-200 shadow-inner bg-gray-200 mt-6">
              <iframe 
                title={`Map of ${restaurant.title}`}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                style={{ border: 0 }} 
                src={mapEmbedUrl} 
                allowFullScreen 
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          )}
        </div>
      )}

    </div>
  );
}