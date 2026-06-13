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