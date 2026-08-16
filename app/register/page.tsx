// /app/register/page.tsx
'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

// SECURE: Explicitly excluding private admin columns from the delta update fetch
const SAFE_UPDATE_COLUMNS = 'id, title, description, address, restaurant_price, total_seats, avg_stay_time, takeout_menu, operating_hours, hours_source, image_url, custom_fields, other_options, menu_items';

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
    },
    {
      id: "sec_menu",
      title: "2. 詳細メニュー",
      description: "店舗の代表的なメニューを追加してください。",
      blocks: [
        { id: "b_menu_table", type: "menu_builder", label: "詳細メニュー登録", dbColumn: "menu_items", required: false }
      ]
    }
  ]
};

// --- DYNAMIC MENU BUILDER COMPONENT ---
const MenuBuilder = ({ block, onChange, currentValue }: { block: any, onChange: (val: any) => void, currentValue: any }) => {
  const [items, setItems] = useState<any[]>(Array.isArray(currentValue) && currentValue.length > 0 ? currentValue : [{ name: '', price: '', description: '' }]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
    // Only push valid items up to formData
    onChange(newItems.filter(i => i.name.trim() !== ''));
  };

  const addItem = () => setItems([...items, { name: '', price: '', description: '' }]);
  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) newItems.push({ name: '', price: '', description: '' });
    setItems(newItems);
    onChange(newItems.filter(i => i.name.trim() !== ''));
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {block.label} {block.required && <span className="text-red-500">*</span>}
      </label>
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-3 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="flex-1 space-y-3">
            <input type="text" placeholder="メニュー名 (Name)" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition" />
            <textarea placeholder="説明 (Description) - オプション" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} rows={2} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition" />
          </div>
          <div className="w-full sm:w-32 flex flex-col gap-3">
            <input type="number" placeholder="価格 (¥)" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition" />
            <button type="button" onClick={() => removeItem(idx)} className="mt-auto py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition">削除</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold hover:bg-gray-50 hover:border-orange-400 hover:text-orange-500 transition">
        + メニューを追加
      </button>
    </div>
  );
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
            <span className="text-xs font-bold text-gray-500">{previews.length} / {maxLimit} 枚アップロード済み</span>
            {previews.length < maxLimit && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition">
                + 画像を追加
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
            タップして画像をアップロード {isMultiple ? `(最大 ${maxLimit} 枚)` : ''}
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
  
  // Security Gate State
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

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
      if (searchQuery.trim().length > 1 && !updateTargetId && !selectedTarget) {
        setIsSearching(true);
        const { data } = await supabase.from('restaurants').select('id, title, address').eq('status', 'approved').ilike('title', `%${searchQuery}%`).limit(10);
        setSearchResults(data || []);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, updateTargetId, selectedTarget]);

  const handleSelectSearchResult = (restaurant: any) => {
    setSelectedTarget(restaurant);
    setSearchResults([]);
    setSearchQuery(restaurant.title);
    setPinInput('');
    setPinError('');
  };

  const verifyPinAndLoad = async (restaurant: any) => {
    setPinError('');
    setLoading(true);

    const { data, error } = await supabase.from('restaurants').select(SAFE_UPDATE_COLUMNS).eq('id', restaurant.id).single();
    
    if (error) {
      setPinError(`データの取得に失敗しました: ${error.message}`);
      setLoading(false);
      return;
    }

    const actualPin = data?.custom_fields?.edit_pin;

    if (actualPin && actualPin !== pinInput) {
      setPinError('PINコードが間違っています。');
      setLoading(false);
      return;
    }

    setLoading(false);
    setUpdateTargetId(restaurant.id);
    setSelectedTarget(null);
    setPinInput('');
    
    const newFormData: any = {};
    Object.keys(data).forEach(key => {
      if (key !== 'custom_fields' && key !== 'other_options' && key !== 'id') newFormData[key] = data[key];
    });
    
    if (data.custom_fields) {
      Object.keys(data.custom_fields).forEach(key => { newFormData[`custom_fields.${key}`] = data.custom_fields[key]; });
    }
    
    if (!newFormData.hours_source) newFormData.hours_source = data.operating_hours || 'Googleマップと同じ';
    
    setFormData(newFormData);
    setSelectedEvents(data.other_options || []);
  };

  const handleInputChange = (dbColumn: string, value: any) => setFormData(prev => ({ ...prev, [dbColumn]: value }));

  const handleCheckboxArray = (dbColumn: string, option: string, isChecked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[dbColumn] || [];
      if (isChecked) return { ...prev, [dbColumn]: [...currentArray, option] };
      return { ...prev, [dbColumn]: currentArray.filter((o: string) => o !== option) };
    });
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
      if (key === 'id') continue; 
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
            setMessage(`画像のアップロードに失敗しました: ${uploadErr.message}`);
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
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('情報が正常に送信されました！ご協力ありがとうございます。');
      setFormData({ hours_source: 'Googleマップと同じ' });
      setSelectedEvents([]);
      setUpdateTargetId(null);
      setSelectedTarget(null);
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
        
        {block.type === 'menu_builder' && (
          <MenuBuilder block={block} onChange={(items) => handleInputChange(block.dbColumn, items)} currentValue={formData[block.dbColumn]} />
        )}

        {block.type === 'hours_source' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-4">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {block.options?.map((opt: string) => (
                <label key={opt} className={`flex items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData[block.dbColumn] === opt ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <input type="radio" name={block.dbColumn} value={opt} checked={formData[block.dbColumn] === opt} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="hidden" />
                  <span className="font-bold text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {block.type === 'text' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <input type={block.validation === 'number' ? 'number' : block.validation === 'email' ? 'email' : block.validation === 'url' ? 'url' : 'text'} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} required={block.required} placeholder={block.placeholder} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition" />
          </div>
        )}

        {block.type === 'textarea' && (
           <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <textarea value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} required={block.required} placeholder={block.placeholder} rows={4} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-medium text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition" />
          </div>
        )}

        {block.type === 'select' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <select value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} required={block.required} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition cursor-pointer">
              <option value="" disabled>選択してください</option>
              {block.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        )}

        {(block.type === 'checkbox' || block.type === 'photo_method') && (
           <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex flex-wrap gap-3">
              {block.options?.map((opt: string) => {
                const isChecked = (formData[block.dbColumn] || []).includes(opt);
                return (
                  <label key={opt} className={`flex items-center cursor-pointer p-3 rounded-xl border-2 transition-all ${isChecked ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={isChecked} onChange={(e) => handleCheckboxArray(block.dbColumn, opt, e.target.checked)} className="hidden" />
                    <span className="font-bold text-sm">{opt}</span>
                  </label>
                );
              })}
            </div>
           </div>
        )}

        {block.type === 'radio' && (
           <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex flex-wrap gap-3">
              {block.options?.map((opt: string) => {
                const isChecked = formData[block.dbColumn] === opt;
                return (
                  <label key={opt} className={`flex items-center cursor-pointer p-3 rounded-xl border-2 transition-all ${isChecked ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <input type="radio" name={block.dbColumn} value={opt} checked={isChecked} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="hidden" />
                    <span className="font-bold text-sm">{opt}</span>
                  </label>
                );
              })}
            </div>
           </div>
        )}

        {block.type === 'operating_hours' && (
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-4">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-6 rounded-[24px] border border-gray-200">
               {DAYS.map(day => (
                 <div key={day} className="flex items-center gap-3">
                    <span className="w-16 font-bold text-gray-600 text-sm text-right">{day}</span>
                    <input type="text" value={formData[`hours_${day}`] || ''} onChange={(e) => handleInputChange(`hours_${day}`, e.target.value)} placeholder="例: 11:00〜22:00" className="flex-1 p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition" />
                 </div>
               ))}
             </div>
           </div>
        )}

        {block.type === 'image_upload' && (
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">
              {block.label} {block.required && <span className="text-red-500">*</span>}
            </label>
            <PublicImageUploader block={block} onImageSelected={(files) => handleInputChange(block.dbColumn, files)} currentValue={formData[block.dbColumn]} />
          </div>
        )}

        {block.type === 'html' && (
          <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: block.content || '' }} />
        )}

        {activeCondition && (
          <div className="mt-6 pl-6 border-l-2 border-orange-200 space-y-6">
            {activeCondition.blocks.map((childBlock: any) => renderFormBlock(childBlock))}
          </div>
        )}
      </div>
    );
  };

  if (!mounted || !schema) return null;

  return (
    <div className={`min-h-screen bg-gray-50 ${isIframe ? 'p-4' : 'py-12 px-4'}`}>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-gray-200">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-6">{schema.pageTitle}</h1>
          <p className="text-gray-600 font-medium whitespace-pre-wrap leading-relaxed">{schema.pageDescription}</p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-gray-200">
           <div className="flex flex-wrap gap-4 mb-6 bg-gray-100 p-1.5 rounded-2xl w-fit">
              <button type="button" onClick={() => { setIsUpdateMode(false); setUpdateTargetId(null); setSelectedTarget(null); setFormData({ hours_source: 'Googleマップと同じ' }); }} className={`px-6 py-2.5 rounded-xl font-black text-sm transition ${!isUpdateMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>新規登録</button>
              <button type="button" onClick={() => setIsUpdateMode(true)} className={`px-6 py-2.5 rounded-xl font-black text-sm transition ${isUpdateMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>既存店舗の情報を更新</button>
           </div>
           
           {isUpdateMode && !updateTargetId && !selectedTarget && (
              <div className="relative">
                <label className="block text-sm font-bold text-gray-700 mb-2">情報を更新する店舗を検索してください:</label>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="店舗名を入力..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500" />
                {isSearching && <div className="text-xs font-bold text-gray-400 mt-2">データベースを検索中...</div>}
                {searchResults.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden z-50">
                      {searchResults.map(res => (
                         <button key={res.id} type="button" onClick={() => handleSelectSearchResult(res)} className="w-full text-left p-4 hover:bg-orange-50 border-b border-gray-100 last:border-0 transition">
                            <div className="font-black text-gray-900">{res.title}</div>
                            <div className="text-xs text-gray-500 truncate">{res.address}</div>
                         </button>
                      ))}
                   </div>
                )}
              </div>
           )}

           {isUpdateMode && selectedTarget && !updateTargetId && (
              <div className="bg-orange-50 border border-orange-200 p-8 rounded-[32px] text-center animate-in zoom-in-95 duration-200">
                 <h3 className="text-xl font-black text-orange-900 mb-2">{selectedTarget.title}</h3>
                 <p className="text-orange-700 text-sm font-bold mb-6">情報を更新するには、登録時に設定した4桁のPINコードを入力してください。</p>
                 <div className="flex flex-col items-center gap-4">
                    <input 
                      type="password" 
                      maxLength={4} 
                      value={pinInput} 
                      onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))} 
                      placeholder="PIN" 
                      className="w-32 p-4 text-center text-2xl tracking-[0.5em] font-black border-2 border-orange-300 rounded-2xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-200" 
                    />
                    {pinError && <p className="text-red-500 font-bold text-xs bg-red-50 px-3 py-1 rounded-md">{pinError}</p>}
                    <div className="flex gap-3 mt-2">
                      <button type="button" onClick={() => setSelectedTarget(null)} className="px-6 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition">キャンセル</button>
                      <button type="button" onClick={() => verifyPinAndLoad(selectedTarget)} disabled={loading || pinInput.length < 4} className="px-6 py-3 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 transition shadow-md disabled:opacity-50">認証する</button>
                    </div>
                 </div>
              </div>
           )}

           {isUpdateMode && updateTargetId && (
              <div className="bg-orange-50 border border-orange-200 p-5 rounded-[24px] flex flex-wrap justify-between items-center gap-4 animate-in fade-in duration-300">
                 <div>
                    <div className="text-xs font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                       <span className="relative flex h-2 w-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                       </span>
                       更新対象の店舗
                    </div>
                    <div className="font-black text-gray-900 text-lg">{searchQuery}</div>
                 </div>
                 <button type="button" onClick={() => { setUpdateTargetId(null); setSelectedTarget(null); setSearchQuery(''); setFormData({ hours_source: 'Googleマップと同じ' }); }} className="text-xs font-bold bg-white text-gray-600 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 shadow-sm transition">変更・キャンセル</button>
              </div>
           )}
        </div>

        {(!isUpdateMode || updateTargetId) && (
          <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {schema.sections.map((section: any) => (
              <div key={section.id} className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 mb-2">{section.title}</h2>
                {section.description && <p className="text-gray-500 text-sm font-bold mb-8">{section.description}</p>}
                
                <div className="space-y-8">
                  {section.blocks.map((block: any) => renderFormBlock(block))}
                </div>
              </div>
            ))}

            {/* MANDATORY SECURITY PIN BLOCK */}
            <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-gray-200">
              <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                セキュリティ
              </h2>
              <p className="text-gray-500 text-sm font-bold mb-6">
                次回以降、店舗情報を更新・修正する際に必要な暗証番号を設定してください。<br/>
                <span className="text-xs font-medium opacity-80">(今後の店舗情報の更新に必要な4桁のPINコードを設定してください)</span>
              </p>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">更新用PINコード <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  value={formData['custom_fields.edit_pin'] || ''} 
                  onChange={(e) => handleInputChange('custom_fields.edit_pin', e.target.value.replace(/\D/g, ''))} 
                  placeholder="例: 1234" 
                  className="w-full max-w-[200px] p-4 bg-gray-50 border border-gray-200 rounded-2xl font-black text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition tracking-[0.5em] text-center text-2xl" 
                />
              </div>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-gray-200 text-center">
               {message && (
                 <div className={`p-4 rounded-2xl mb-6 font-bold text-sm ${message.includes('エラー') || message.includes('失敗') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                   {message}
                 </div>
               )}
               <button type="submit" disabled={loading} className="w-full md:w-auto px-12 py-5 bg-orange-600 text-white font-black rounded-full hover:bg-orange-700 shadow-xl shadow-orange-600/20 transition-all transform hover:-translate-y-1 disabled:opacity-50 text-lg">
                 {loading ? '送信中...' : '店舗情報を送信する'}
               </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}　