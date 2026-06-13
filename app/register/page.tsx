// /app/register/page.tsx
'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

// SECURE: Explicitly excluding private admin columns from the delta update fetch
const SAFE_UPDATE_COLUMNS = 'id, title, description, address, restaurant_price, total_seats, avg_stay_time, takeout_menu, operating_hours, hours_source, image_url, custom_fields, other_options';

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];

const BASELINE_SCHEMA = {
  pageTitle: "ワセメシ情報ご提供のお願い",
  pageDescription: "私たちは早稲田大学国際教養学部の「イートチーム」と申します。\n「ワセメシ」の魅力をもっと多くの方に知っていただき、地域のお店と学生・観光客をつなぐ多言語対応のレストラン検索サイト「イートダキマス」を作成しています。\n\n✅ 掲載はすべて無料です\n✅ 頂いた情報を元に、こちらで多言語（英語等）に翻訳して掲載します\n✅ 所要時間は5〜10分程度です",
  sections: [
    {
      id: "sec_1",
      title: "1. 店舗の基本情報",
      description: "",
      blocks: [
        { id: "b_title", type: "text", label: "店舗名 (🌐 サイト公開)", dbColumn: "title", required: true, placeholder: "例：いねや本館" },
        { id: "b_address", type: "text", label: "住所 (🌐 サイト公開)", dbColumn: "address", required: false, placeholder: "例：東京都新宿区西早稲田1-2-3" }
      ]
    }
  ]
};

// --- PUBLIC IMAGE UPLOADER COMPONENT ---
const PublicImageUploader = ({ block, onImageSelected, currentValue }: { block: any, onImageSelected: (files: File | File[] | null) => void, currentValue: any }) => {
  const [previews, setPreviews] = useState<{file?: File, url: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const maxLimit = block.maxImages || 1;
  const isMultiple = maxLimit > 1;

  useEffect(() => {
    if (!currentValue) {
      setPreviews([]);
    } else if (currentValue instanceof File) {
      setPreviews([{ file: currentValue, url: URL.createObjectURL(currentValue) }]);
    } else if (typeof currentValue === 'string' && currentValue.startsWith('http')) {
      setPreviews([{ url: currentValue }]);
    } else if (Array.isArray(currentValue)) {
      const processedPreviews = currentValue.map((item: any) => {
        if (item instanceof File) return { file: item, url: URL.createObjectURL(item) };
        else if (typeof item === 'string' && item.startsWith('http')) return { url: item };
        return null;
      }).filter(Boolean);
      setPreviews(processedPreviews as {file?: File, url: string}[]);
    }
  }, [currentValue]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validImages = files.filter(f => f.type.startsWith('image/'));
    
    setPreviews(prev => {
      const combined = [...prev];
      for (const file of validImages) {
        if (combined.length < maxLimit) combined.push({ file, url: URL.createObjectURL(file) });
      }
      const filesOnly = combined.map(p => p.file).filter(Boolean) as File[];
      const filePayload = filesOnly.length === 0 ? null : (isMultiple ? filesOnly : filesOnly[0]);
      onImageSelected(filePayload);
      return combined;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setPreviews(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      const filesOnly = updated.map(p => p.file).filter(Boolean) as File[];
      const filePayload = filesOnly.length === 0 ? null : (isMultiple ? filesOnly : filesOnly[0]);
      onImageSelected(filePayload);
      return updated;
    });
  };

  return (
    <div className="mt-2 w-full animate-in fade-in duration-300">
      <input type="file" accept="image/*" multiple={isMultiple} onChange={handleFileChange} ref={fileInputRef} className="hidden" />
      {previews.length > 0 ? (
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-inner">
          <div className="flex justify-between items-end mb-4">
            <span className="text-xs font-bold text-gray-500">{previews.length} / {maxLimit} uploaded</span>
            {previews.length < maxLimit && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition">
                + Add More
              </button>
            )}
          </div>
          <div className={`grid gap-4 ${isMultiple ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:w-48'}`}>
            {previews.map((preview, idx) => (
              <div key={idx} className="relative group aspect-square">
                <img src={preview.url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-gray-300 shadow-sm bg-white" />
                <button type="button" onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-md transform scale-0 group-hover:scale-100 transition-transform">✕</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-12 px-4 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-white hover:border-orange-400 hover:shadow-md transition-all group text-gray-500">
          <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-gray-700 group-hover:text-orange-600 transition-colors">
            Tap to Upload {isMultiple ? `(Up to ${maxLimit} photos)` : 'Photo'}
          </span>
          {block.placeholder && <span className="text-xs mt-2 text-gray-400 font-medium text-center">{block.placeholder}</span>}
        </button>
      )}
    </div>
  );
};

export default function RegisterRestaurant() {
  const [schema, setSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({ hours_source: 'Googleマップと同じ' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Delta Update State
  const [isUpdateMode, setIsUpdateMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null);

  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsIframe(window.self !== window.top);

    const fetchData = async () => {
      try {
        const [schemaRes, eventsRes, adsRes] = await Promise.all([
          supabase.from('site_settings').select('data').eq('id', 'registration_schema').maybeSingle(),
          supabase.from('custom_categories').select('*').order('created_at'),
          supabase.from('ad_campaigns').select('*').eq('is_active', true).in('target_page', ['*', '/register'])
        ]);

        if (schemaRes.data?.data?.sections?.length > 0) setSchema(schemaRes.data.data);
        else setSchema(BASELINE_SCHEMA);

        if (eventsRes.data) {
          const today = new Date().toISOString().split('T')[0]; 
          const validEvents = eventsRes.data.filter(e => {
            if (e.is_constant) return true;
            const start = e.start_date ? e.start_date.split('T')[0] : null;
            const end = e.end_date ? e.end_date.split('T')[0] : null;
            if (start && end) return today >= start && today <= end;
            if (start) return today >= start;
            if (end) return today <= end;
            return true;
          });
          setActiveEvents(validEvents);
        }
        if (adsRes.data) setAds(adsRes.data);
      } catch (err) {
        setSchema(BASELINE_SCHEMA);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1 && !updateTargetId) {
        setIsSearching(true);
        const { data } = await supabase.from('restaurants').select('id, title, address').eq('status', 'approved').ilike('title', `%${searchQuery}%`).limit(10);
        setSearchResults(data || []);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, updateTargetId]);

  const handleSelectRestaurantToUpdate = async (restaurant: any) => {
    setUpdateTargetId(restaurant.id);
    setSearchQuery(restaurant.title);
    setSearchResults([]);
    setLoading(true);

    const { data, error } = await supabase.from('restaurants').select(SAFE_UPDATE_COLUMNS).eq('id', restaurant.id).single();
    
    setLoading(false);
    if (data) {
      const newFormData: any = {};
      Object.keys(data).forEach(key => {
        if (key !== 'custom_fields' && key !== 'other_options') newFormData[key] = data[key];
      });
      if (data.custom_fields) {
        Object.keys(data.custom_fields).forEach(key => { newFormData[`custom_fields.${key}`] = data.custom_fields[key]; });
      }
      if (!newFormData.hours_source) newFormData.hours_source = data.operating_hours || 'Googleマップと同じ';
      
      setFormData(newFormData);
      setSelectedEvents(data.other_options || []);
    } else if (error) {
      setMessage(`データの取得に失敗しました: ${error.message}`);
    }
  };

  const handleInputChange = (dbColumn: string, value: any) => setFormData(prev => ({ ...prev, [dbColumn]: value }));

  const handleCheckboxArray = (dbColumn: string, option: string, isChecked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[dbColumn] || [];
      if (isChecked) return { ...prev, [dbColumn]: [...currentArray, option] };
      return { ...prev, [dbColumn]: currentArray.filter((o: string) => o !== option) };
    });
  };

  const handleEventToggle = (eventName: string, isChecked: boolean) => {
    if (isChecked) setSelectedEvents(prev => [...prev, eventName]);
    else setSelectedEvents(prev => prev.filter(e => e !== eventName));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const payload: any = { status: 'pending', custom_fields: {}, other_options: selectedEvents };
    
    if (isUpdateMode && updateTargetId) {
      payload.custom_fields.update_target_id = updateTargetId;
      payload.custom_fields.update_target_name = searchQuery;
    }
    
    for (const key of Object.keys(formData)) {
      if (key.startsWith('hours_') && key !== 'hours_source') continue;
      
      const value = formData[key];
      
      if (value instanceof File || (Array.isArray(value) && value[0] instanceof File)) {
        const files = Array.isArray(value) ? value : [value];
        const uploadedUrls: string[] = [];

        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `public-upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          try {
            const { error: uploadError } = await supabase.storage.from('restaurant-images').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: publicData } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
            uploadedUrls.push(publicData.publicUrl);
          } catch (uploadErr: any) {
            setMessage(`Image upload failed: ${uploadErr.message}`);
            setLoading(false);
            return;
          }
        }
        
        const finalUrlData = key === 'image_urls' ? uploadedUrls : uploadedUrls[0];
        if (key.startsWith('custom_fields.')) payload.custom_fields[key.replace('custom_fields.', '')] = finalUrlData;
        else payload[key] = finalUrlData;
        continue;
      }

      if (key.startsWith('custom_fields.')) payload.custom_fields[key.replace('custom_fields.', '')] = value;
      else payload[key] = value;
    }

    let finalHours: any = '';
    const hSource = formData['hours_source'];
    if (hSource === 'ここで手動で入力する') {
      const hoursObj: Record<string, string> = {};
      DAYS.forEach(day => { hoursObj[day] = formData[`hours_${day}`] || ''; });
      finalHours = JSON.stringify(hoursObj);
    } else {
      finalHours = hSource || '';
    }
    payload.operating_hours = finalHours;

    const { error } = await supabase.from('restaurants').insert([payload]);

    setLoading(false);
    if (error) {
      setMessage(`Error occurred: ${error.message}`);
    } else {
      setMessage('Information submitted successfully! Thank you for your cooperation.');
      setFormData({ hours_source: 'Googleマップと同じ' });
      setSelectedEvents([]);
      setUpdateTargetId(null);
      setSearchQuery('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderFormBlock = (block: any) => {
    const activeCondition = block.conditions?.find((c: any) => {
      const val = formData[block.dbColumn];
      if (Array.isArray(val)) return val.includes(c.triggerValue);
      return val === c.triggerValue;
    });

    return (
      <div key={block.id} className="animate-in fade-in duration-300">
        {block.type === 'hours_source' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-4">{block.label} {block.required && <span className="text-red-500">*</span>}</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {block.options?.map((opt: string) => (
                <label key={opt} className="cursor-pointer">
                  <input type="radio" required={block.required && !formData[block.dbColumn]} checked={formData[block.dbColumn] === opt} onChange={() => handleInputChange(block.dbColumn, opt)} className="peer sr-only" />
                  <div className="px-4 py-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 text-center font-bold text-gray-600 peer-checked:text-orange-700 transition">
                    {opt}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {block.type === 'operating_hours' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <p className="md:col-span-2 text-sm text-gray-500 mb-2 font-medium">※ 定休日の場合は未記入、営業日は「11:00〜14:00、17:00〜21:00」のようにご記入ください。</p>
            {DAYS.map(day => (
              <div key={day} className="flex items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 transition">
                 <span className="w-24 font-bold text-gray-700">{day}</span>
                 <input type="text" value={formData[`hours_${day}`] || ''} onChange={(e) => handleInputChange(`hours_${day}`, e.target.value)} className="flex-grow px-3 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm font-bold text-gray-800" placeholder="11:00〜20:00" />
              </div>
            ))}
          </div>
        )}

        {block.type === 'photo_method' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-4">{block.label} {block.required && <span className="text-red-500">*</span>}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {block.options?.map((opt: string) => {
                const getSub = (o: string) => o.includes("メール") ? "eatodakimasu@gmail.com宛" : o.includes("HP") ? "HPのリンクを共有してください" : o.includes("スタッフ") ? "後日日程調整のご連絡をします" : "";
                return (
                  <label key={opt} className="cursor-pointer">
                    <input type="radio" required={block.required && !formData[block.dbColumn]} checked={formData[block.dbColumn] === opt} onChange={() => handleInputChange(block.dbColumn, opt)} className="peer sr-only" />
                    <div className="p-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 transition">
                      <p className="font-bold text-gray-800 peer-checked:text-orange-900">{opt}</p>
                      <p className="text-xs text-gray-500 mt-1">{getSub(opt)}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {!['hours_source', 'operating_hours', 'photo_method'].includes(block.type) && (
          <div>
            {block.type !== 'html' && (
              <label className="block text-sm font-bold text-gray-700 mb-3">
                {block.label} {block.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}

            {block.type === 'html' && <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: block.content }} />}
            {block.type === 'text' && <input type="text" required={block.required && !formData[block.dbColumn]} placeholder={block.placeholder} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" />}
            {block.type === 'textarea' && <textarea rows={4} required={block.required && !formData[block.dbColumn]} placeholder={block.placeholder} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" />}
            
            {block.type === 'select' && (
              <select required={block.required && !formData[block.dbColumn]} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer font-bold text-gray-700">
                <option value="">選択してください</option>
                {block.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}

            {(block.type === 'checkbox' || block.type === 'radio') && (
              <div className="flex flex-wrap gap-3">
                {block.options?.map((opt: string) => {
                  const isChecked = block.type === 'checkbox' ? (formData[block.dbColumn] || []).includes(opt) : formData[block.dbColumn] === opt;
                  return (
                    <label key={opt} className="cursor-pointer">
                      <input type={block.type} required={block.required && !formData[block.dbColumn] && block.type === 'radio'} className="peer sr-only" checked={isChecked} onChange={(e) => block.type === 'checkbox' ? handleCheckboxArray(block.dbColumn, opt, e.target.checked) : handleInputChange(block.dbColumn, opt)} />
                      <div className="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-orange-600 peer-checked:text-white peer-checked:border-orange-600 text-sm font-bold text-gray-600 transition shadow-sm hover:bg-gray-50">{opt}</div>
                    </label>
                  )
                })}
              </div>
            )}

            {block.type === 'image_upload' && (
              <PublicImageUploader 
                block={block} 
                currentValue={formData[block.dbColumn]}
                onImageSelected={(file) => handleInputChange(block.dbColumn, file)}
              />
            )}
          </div>
        )}

        {activeCondition && activeCondition.blocks?.length > 0 && (
           <div className="mt-6 ml-4 md:ml-6 pl-4 md:pl-6 border-l-[3px] border-orange-300 space-y-8 relative">
              {activeCondition.blocks.map((childBlock: any) => renderFormBlock(childBlock))}
           </div>
        )}
      </div>
    );
  };

  if (!schema) return <div className="text-center py-20 font-black tracking-widest text-gray-400 animate-pulse">LOADING FORM...</div>;

  return (
    <div className="w-full relative">
      {mounted && !isIframe && createPortal(
        <>
          <div className="hidden lg:block absolute top-0 left-1/2 transform -translate-x-1/2 w-[1600px] h-0 z-40 pointer-events-none">
            {ads.map(ad => (
              <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" className="absolute pointer-events-auto rounded-[1.5rem] overflow-hidden transition hover:opacity-90 bg-gray-50 shadow-lg" style={{ left: ad.x, top: ad.y, width: ad.w, height: ad.h }}>
                <img src={ad.image_url} className="w-full h-full object-cover" alt="Advertisement" />
              </a>
            ))}
          </div>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
            {ads.filter(a => a.mobile_fallback === 'sticky').map(ad => (
              <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" className="w-full h-20 bg-white flex items-center px-5 gap-4 border-t border-gray-200 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <img src={ad.image_url} className="w-12 h-12 rounded-xl object-cover" alt="Sponsored" />
                <div className="flex flex-col flex-1 truncate">
                  <span className="font-black text-sm text-gray-900">Special Promo</span>
                  <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wide">Sponsored</span>
                </div>
                <span className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-xs font-black">Open</span>
              </a>
            ))}
          </div>
        </>,
        document.body
      )}

      <div className="max-w-4xl mx-auto py-8 px-4 relative z-10">
        
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl p-8 md:p-12 text-white shadow-lg mb-8">
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">{schema.pageTitle}</h1>
          <p className="text-orange-50 font-medium leading-relaxed whitespace-pre-line">{schema.pageDescription}</p>
        </div>

        {message && (
          <div className={`p-5 mb-8 rounded-2xl font-bold text-center shadow-sm ${message.includes('エラー') || message.includes('failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
            {message}
          </div>
        )}

        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-2xl font-black text-gray-900 mb-4 border-b pb-4">登録の種類</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label className="cursor-pointer">
              <input type="radio" checked={!isUpdateMode} onChange={() => { setIsUpdateMode(false); setUpdateTargetId(null); setSearchQuery(''); setFormData({ hours_source: 'Googleマップと同じ' }); }} className="peer sr-only" />
              <div className="px-4 py-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 text-center font-bold text-gray-600 peer-checked:text-orange-700 transition shadow-sm">
                新しい店舗を登録する
              </div>
            </label>
            <label className="cursor-pointer">
              <input type="radio" checked={isUpdateMode} onChange={() => setIsUpdateMode(true)} className="peer sr-only" />
              <div className="px-4 py-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 text-center font-bold text-gray-600 peer-checked:text-orange-700 transition shadow-sm">
                既存の店舗情報を更新する
              </div>
            </label>
          </div>

          {isUpdateMode && (
            <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 animate-in fade-in zoom-in-95 duration-200">
              <label className="block text-sm font-bold text-gray-800 mb-2">更新する店舗を検索してください</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setUpdateTargetId(null); }}
                  placeholder="店舗名を入力..." 
                  className="w-full px-5 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-800 shadow-sm"
                />
                {isSearching && <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-orange-500 font-bold text-sm animate-pulse">検索中...</span>}
              </div>
              
              {searchResults.length > 0 && !updateTargetId && (
                <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map(res => (
                    <button 
                      key={res.id} 
                      type="button"
                      onClick={() => handleSelectRestaurantToUpdate(res)}
                      className="w-full text-left px-5 py-3 border-b border-gray-100 hover:bg-orange-50 focus:bg-orange-50 transition"
                    >
                      <div className="font-bold text-gray-900">{res.title}</div>
                      <div className="text-xs text-gray-500 truncate">{res.address}</div>
                    </button>
                  ))}
                </div>
              )}

              {updateTargetId && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-green-800 font-black text-sm">✓ 店舗データ読み込み完了 (Public data only)</span>
                    <span className="text-green-600 text-xs font-bold mt-1">以下のフォームに現在の情報が入力されています。修正箇所を書き換えて送信してください。</span>
                  </div>
                  <button type="button" onClick={() => { setUpdateTargetId(null); setSearchQuery(''); setFormData({ hours_source: 'Googleマップと同じ' }); }} className="text-sm font-bold bg-white text-green-700 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition">変更</button>
                </div>
              )}
            </div>
          )}
        </section>

        <form id="registration-form" onSubmit={handleSubmit} className={`space-y-8 transition-opacity duration-300 ${isUpdateMode && !updateTargetId ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          {schema.sections.map((section: any, index: number) => (
            <div key={section.id} className="space-y-8">
              <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 mb-2 border-b pb-4">{index + 1}. {section.title}</h2>
                {section.description && <p className="text-gray-500 text-sm font-medium mb-6 whitespace-pre-line">{section.description}</p>}
                
                <div className="space-y-8 mt-6">
                  {section.blocks.map((block: any) => renderFormBlock(block))}
                </div>
              </section>

              {index === 0 && activeEvents.length > 0 && (
                <section className="p-8 md:p-10 bg-purple-50 border border-purple-100 rounded-[32px] space-y-6">
                  <div className="mb-2">
                    <h2 className="text-2xl font-black text-purple-900 mb-2 flex items-center gap-2"><span>🎉</span> 参加イベント・キャンペーン</h2>
                    <p className="text-sm font-medium text-purple-800/80">イベントに参加している場合はチェックを入れてください。</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {activeEvents.map(event => (
                      <label key={event.id} className="flex items-start cursor-pointer p-4 rounded-2xl border border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm">
                        <div className="flex items-center h-6 mt-1">
                          <input type="checkbox" checked={selectedEvents.includes(event.name)} onChange={(e) => handleEventToggle(event.name, e.target.checked)} className="w-5 h-5 accent-purple-600 rounded" />
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${event.is_constant ? 'bg-slate-200 text-slate-800' : 'bg-purple-200 text-purple-900'}`}>
                              {event.is_constant ? '📌 常設 / Permanent' : '⏰ 期間限定 / Seasonal'}
                            </span>
                          </div>
                          <span className="font-black text-gray-900 text-lg">{event.name}</span>
                          {event.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ))}

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xl font-black py-5 px-6 rounded-2xl hover:from-orange-700 hover:to-orange-600 transition shadow-lg hover:shadow-xl disabled:opacity-50 transform hover:-translate-y-1">
            {loading ? '送信中... (Submitting)' : isUpdateMode ? '更新内容を送信する' : 'この内容で店舗を登録する'}
          </button>
        </form>
      </div>
    </div>
  );
}