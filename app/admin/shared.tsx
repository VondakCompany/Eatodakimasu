// app/admin/shared.tsx
'use client';
import React, { useState } from 'react';
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
    case 'campus': return 'restaurant_area'; 
    case 'area': return 'restaurant_area'; 
    case 'other': return 'other_options';
    case 'discount_type': return 'discount_type';
    case 'seats': return 'total_seats';
    default: return 'other_options';
  }
};

// 🚀 BULLETPROOF DIFF: Converts all values to strings to prevent Number vs String false positives
export const getChangedFields = (original: any, delta: any, formBaseColumns: any[]) => {
  if (!original) return ['Original Restaurant Not Found'];
  const changes: string[] = [];
  
  const keysToCheck = ['title', 'description', 'address', 'restaurant_price', 'total_seats', 'avg_stay_time', 'takeout_menu', 'hours_source', 'image_url', 'contact_name', 'contact_phone', 'contact_email', 'photo_method', 'admin_notes', 'discount_info', 'full_menu', 'website_url'];
  
  keysToCheck.forEach(k => { 
    const oVal = original[k] === null || original[k] === undefined ? '' : String(original[k]).trim();
    const dVal = delta[k] === null || delta[k] === undefined ? '' : String(delta[k]).trim();
    if (oVal !== dVal) changes.push(k);
  });

  const origHours = typeof original?.operating_hours === 'object' ? JSON.stringify(original.operating_hours) : String(original?.operating_hours || '');
  const deltaHours = typeof delta?.operating_hours === 'object' ? JSON.stringify(delta.operating_hours) : String(delta?.operating_hours || '');
  if (origHours !== deltaHours) changes.push('operating_hours');
  
  const sortArr = (arr: any) => (Array.isArray(arr) ? [...arr].sort().join(',') : '');
  if (sortArr(original?.other_options) !== sortArr(delta?.other_options)) changes.push('events_and_categories');
  if (sortArr(original?.image_urls) !== sortArr(delta?.image_urls)) changes.push('gallery_images');
  
  const origCustom = original?.custom_fields || {};
  const deltaCustom = delta?.custom_fields || {};
  const customKeys = new Set([...Object.keys(origCustom), ...Object.keys(deltaCustom)]);
  
  customKeys.forEach(k => {
    if (k !== 'update_target_id' && k !== 'update_target_name') {
       const oVal = origCustom[k] === null || origCustom[k] === undefined ? '' : String(origCustom[k]).trim();
       const dVal = deltaCustom[k] === null || deltaCustom[k] === undefined ? '' : String(deltaCustom[k]).trim();
       if (oVal !== dVal) {
         const colDef = formBaseColumns?.find((c: any) => c.id === `custom_fields.${k}`);
         changes.push(colDef ? colDef.label : k);
       }
    }
  });
  
  return changes.map(f => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
};

export const Icons = {
  Directory: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>,
  Pending: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Categories: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /></svg>,
  Translations: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
  AdStudio: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  Registration: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  Users: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  Search: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  Lock: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
  MapPin: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  Mail: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>,
  Edit: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>,
  Close: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Sync: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>,
  Eye: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
};

// HELPER: Small component for formatting the read-only fields cleanly in the modal
const ViewField = ({ label, val, fullWidth = false }: { label: string, val: any, fullWidth?: boolean }) => {
  if (val === null || val === undefined || val === '') return null;
  const displayVal = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
  if (displayVal === '[]' || displayVal === '{}') return null;

  return (
    <div className={`bg-gray-50 p-4 rounded-2xl border border-gray-100 ${fullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-sm font-bold text-gray-800 ${fullWidth ? 'whitespace-pre-wrap' : 'truncate'}`}>{displayVal}</div>
    </div>
  );
};

export const RestaurantCard = ({ restaurant, tab, onEdit, onStatusUpdate, onDelete, formBaseColumns = [], liveRestaurants = [] }: any) => {
  const [isViewing, setIsViewing] = useState(false);
  
  const isDelta = !!restaurant.custom_fields?.update_target_id;
  
  // 🚀 FIX: Convert both IDs to Strings so JavaScript strict equality works perfectly
  const originalRestaurant = isDelta && liveRestaurants.length > 0 
    ? liveRestaurants.find((r: any) => String(r.id) === String(restaurant.custom_fields.update_target_id)) 
    : null;
    
  const changedFields = isDelta ? getChangedFields(originalRestaurant, restaurant, formBaseColumns) : [];
  
  return (
    <div className={`p-6 rounded-[32px] shadow-sm border flex flex-col hover:shadow-xl transition-all duration-300 relative ${isDelta ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-200'}`}>
      {isDelta && <div className="mb-3 inline-flex items-center bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase w-max">Delta Update</div>}
      {!isDelta && restaurant.image_url ? <img src={restaurant.image_url} alt="Cover" className="w-full h-40 object-cover rounded-2xl mb-5 bg-gray-50" /> : !isDelta && <div className="w-full h-40 bg-gray-100 rounded-2xl mb-5 flex items-center justify-center text-gray-300 text-xs font-black">NO PHOTO</div>}
      
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-xl font-black text-gray-900 truncate flex-1">{restaurant.title}</h3>
        {restaurant.lat && !isDelta && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-black flex items-center gap-1"><Icons.MapPin className="w-3 h-3" /> GEO</span>}
      </div>
      
      {!isDelta && <p className="text-xs text-orange-500 font-bold mb-4 truncate">{restaurant.address || 'No address provided'}</p>}

      {isDelta && (
        <div className="my-4 bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex-1">
           <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 border-b border-rose-50 pb-2 flex items-center gap-1"><Icons.Edit className="w-3 h-3"/> Changed Fields</h4>
           {changedFields.length > 0 ? <ul className="text-xs font-bold text-gray-700 list-disc pl-5 space-y-1">{changedFields.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul> : <p className="text-xs font-bold text-gray-400">No data changes detected.</p>}
        </div>
      )}

      {!isDelta && restaurant.custom_fields && Object.keys(restaurant.custom_fields).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(restaurant.custom_fields).map(([key, val], idx) => {
            const dbId = `custom_fields.${key}`;
            const colDef = formBaseColumns.find(c => c.id === dbId);
            if (colDef?.is_hidden) return null; 
            
            const label = colDef ? colDef.label : key.replace(/_/g, ' ');
            const isPromoted = colDef && !colDef.is_hidden;
            const vals = Array.isArray(val) ? val : [val];
            
            return vals.map((tag: any, subIdx) => {
              const isImage = typeof tag === 'string' && (tag.startsWith('http') || tag.includes('supabase.co'));
              if (isImage) {
                return (
                  <div key={`${key}-${idx}-${subIdx}`} className={`flex flex-col gap-1 w-16 relative group ${isPromoted ? 'p-1 bg-blue-50 border-blue-200 rounded-lg border' : ''}`}>
                    <span className={`text-[8px] font-black uppercase truncate ${isPromoted ? 'text-blue-600' : 'text-gray-400'}`} title={label}>{isPromoted && '★ '}{label}</span>
                    <img src={tag} alt={key} className="w-full h-16 object-cover rounded-md border border-gray-200" />
                  </div>
                );
              }
              return (
                <span key={`${key}-${idx}-${subIdx}`} className={`text-[9px] font-black px-2 py-1 rounded-md truncate max-w-[120px] flex items-center gap-1 ${isPromoted ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm' : 'text-gray-500 bg-gray-100 border border-transparent'}`} title={`${label}: ${tag}`}>
                  {isPromoted && '★'} {label}: {tag}
                </span>
              );
            });
          })}
        </div>
      )}

      {!isDelta && (
        <div className="flex flex-wrap gap-1 mb-4">
          {['cuisine', 'food_restrictions', 'payment_methods', 'restaurant_area', 'other_options']
            .flatMap(field => restaurant[field] || [])
            .map((tag: any, idx) => <span key={`standard-${tag}-${idx}`} className="text-[9px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-md truncate max-w-[100px]" title={tag}>{tag}</span>)}
        </div>
      )}

      <div className={`bg-slate-50 p-3 rounded-xl border border-slate-200 mb-5 space-y-1 ${isDelta ? 'mt-auto' : ''}`}>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Icons.Lock className="w-3 h-3" /> Private Contact</p>
        <p className="text-xs font-bold text-slate-700 flex justify-between"><span className="text-slate-400">担当者:</span> {restaurant.contact_name || '未設定'}</p>
        <p className="text-xs font-bold text-slate-700 flex justify-between"><span className="text-slate-400">電話:</span> {restaurant.contact_phone || '未設定'}</p>
        <p className="text-xs font-bold text-slate-700 flex justify-between truncate gap-2"><span className="text-slate-400 shrink-0">メール:</span> {restaurant.contact_email || '未設定'}</p>
      </div>

      {/* --- ACTION BUTTONS (Updated with the View Button) --- */}
      <div className="flex gap-2 mt-auto">
        <button onClick={() => setIsViewing(true)} className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition flex items-center justify-center" title="View Immutable Details">
          <Icons.Eye className="w-4 h-4" />
        </button>
        <button onClick={() => onEdit(restaurant)} className="flex-1 bg-gray-900 text-white text-xs font-black py-3 rounded-xl hover:bg-black transition flex items-center justify-center gap-1.5"><Icons.Edit className="w-3.5 h-3.5" /> Edit</button>
        {tab === 'directory' ? (
          <button onClick={() => onStatusUpdate(restaurant, 'pending')} className="flex-1 bg-gray-100 text-gray-600 text-xs font-black py-3 rounded-xl hover:bg-gray-200 transition">Unpublish</button>
        ) : (
          <button onClick={() => onStatusUpdate(restaurant, 'approved')} className="flex-1 bg-green-600 text-white text-xs font-black py-3 rounded-xl hover:bg-green-700 transition">Approve</button>
        )}
        <button onClick={() => onDelete(restaurant.id, restaurant.title)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition flex items-center justify-center"><Icons.Close className="w-4 h-4" /></button>
      </div>

      {/* --- IMMUTABLE READ-ONLY MODAL --- */}
      {isViewing && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setIsViewing(false); }}>
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{restaurant.title || 'Untitled'}</h2>
                <p className="text-sm font-bold text-gray-400">Read-Only Data View</p>
              </div>
              <button onClick={() => setIsViewing(false)} className="text-gray-400 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 w-10 h-10 rounded-full flex items-center justify-center transition">
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ViewField label="Address" val={restaurant.address} fullWidth />
                <ViewField label="Price" val={restaurant.restaurant_price} />
                <ViewField label="Total Seats" val={restaurant.total_seats} />
                <ViewField label="Avg Stay Time" val={restaurant.avg_stay_time} />
                <ViewField label="Contact Name" val={restaurant.contact_name} />
                <ViewField label="Contact Phone" val={restaurant.contact_phone} />
                <ViewField label="Contact Email" val={restaurant.contact_email} />
                <ViewField label="Photo Method" val={restaurant.photo_method} />
                
                <ViewField label="Description" val={restaurant.description} fullWidth />
                <ViewField label="Full Menu" val={restaurant.full_menu} fullWidth />
                <ViewField label="Takeout Menu" val={restaurant.takeout_menu} fullWidth />
                <ViewField label="Discount Info" val={restaurant.discount_info} fullWidth />
                <ViewField label="Admin Notes" val={restaurant.admin_notes} fullWidth />
                <ViewField label="Operating Hours" val={restaurant.operating_hours} fullWidth />

                {/* Tags and Lists rendered cleanly inside the generic viewer */}
                <ViewField label="Cuisines" val={restaurant.cuisine} fullWidth />
                <ViewField label="Food Restrictions" val={restaurant.food_restrictions} fullWidth />
                <ViewField label="Payment Methods" val={restaurant.payment_methods} fullWidth />
                <ViewField label="Areas & Campuses" val={restaurant.restaurant_area} fullWidth />
                <ViewField label="Event Collabs & Options" val={restaurant.other_options} fullWidth />
                <ViewField label="Custom Form Fields" val={restaurant.custom_fields} fullWidth />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};