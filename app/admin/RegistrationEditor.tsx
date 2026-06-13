'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

// SECURE: Explicitly excluding contact_name, contact_phone, contact_email, admin_notes, and photo_method
const SAFE_UPDATE_COLUMNS = 'id, title, description, address, restaurant_price, total_seats, avg_stay_time, takeout_menu, operating_hours, hours_source, image_url, custom_fields, other_options';

type BlockType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'html' | 'hours_source' | 'operating_hours' | 'photo_method' | 'image_upload';

interface FormCondition {
  triggerValue: string;
  blocks: FormBlock[];
}

interface FormBlock {
  id: string;
  type: BlockType;
  label: string;
  placeholder?: string;
  options?: string[]; 
  content?: string; 
  dbColumn: string; 
  required: boolean;
  validation?: 'none' | 'email' | 'url' | 'number' | 'phone';
  conditions?: FormCondition[];
  isPublicCustomField?: boolean;
  maxImages?: number;
}

interface FormSection {
  id: string;
  title: string;
  description: string;
  blocks: FormBlock[];
}

interface FormSchema {
  pageTitle: string;
  pageDescription: string;
  sections: FormSection[];
}

interface VersionHistory {
  timestamp: string;
  schema: FormSchema;
}

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];

const BASELINE_SCHEMA: FormSchema = {
  pageTitle: "ワセメシ情報ご提供のお願い",
  pageDescription: "私たちは早稲田大学国際教養学部の「イートチーム」と申します。\n「ワセメシ」の魅力をもっと多くの方に知っていただき、地域のお店と学生・観光客をつなぐ多言語対応のレストラン検索サイト「イートダキマス」を作成しています。\n\n✅ 掲載はすべて無料です\n✅ 頂いた情報を元に、こちらで多言語（英語等）に翻訳して掲載します\n✅ 所要時間は5〜10分程度です",
  sections: [
    {
      id: "sec_1",
      title: "1. 写真",
      description: "",
      blocks: [
        { id: "b_image", type: "image_upload", label: "店舗やメニューの写真をアップロードしてください", dbColumn: "image_url", required: true, placeholder: "複数枚ある場合は、代表的な1枚をお願いします", maxImages: 1 }
      ]
    },
    {
      id: "sec_2",
      title: "2. 店舗の基本情報",
      description: "",
      blocks: [
        { id: "b_title", type: "text", label: "店舗名 (🌐 サイト公開)", dbColumn: "title", required: true, placeholder: "例：いねや本館" },
        { id: "b_cname", type: "text", label: "ご担当者名 (🔒 非公開)", dbColumn: "contact_name", required: false, placeholder: "例：早稲田 太郎" },
        { id: "b_cphone", type: "text", label: "電話番号 (🔒 非公開)", dbColumn: "contact_phone", required: false, placeholder: "例：03-1234-5678" },
        { id: "b_cemail", type: "text", label: "メールアドレス (🔒 非公開)", dbColumn: "contact_email", required: false, placeholder: "例：shop@example.com" },
        { id: "b_address", type: "text", label: "住所 (🌐 サイト公開)", dbColumn: "address", required: false, placeholder: "例：東京都新宿区西早稲田1-2-3" }
      ]
    },
    {
      id: "sec_3",
      title: "3. 営業時間",
      description: "",
      blocks: [
        { 
          id: "b_hsource", 
          type: "hours_source", 
          label: "営業時間はどちらを参考にすればよろしいですか？", 
          dbColumn: "hours_source", 
          required: true, 
          options: ["Googleマップと同じ", "店舗HPと同じ", "ここで手動で入力する"],
          conditions: [
            {
              triggerValue: "ここで手動で入力する",
              blocks: [
                { id: "b_hmanual", type: "operating_hours", label: "手動入力の場合", dbColumn: "operating_hours", required: false }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "sec_4",
      title: "4. お食事とサービス",
      description: "",
      blocks: [
        { id: "b_cuisine", type: "checkbox", label: "代表的な料理ジャンル (複数可)", dbColumn: "cuisine", required: false, options: ['和食', '洋食', '中華', '韓国料理', 'インド料理', '東南アジア', 'ファストフード', 'カフェ・スイーツ', '寿司', '丼もの'] },
        { id: "b_restrict", type: "checkbox", label: "食事制限への対応 (複数可)", dbColumn: "food_restrictions", required: false, options: ['ハラール', 'ヴィーガン', 'ベジタリアン', 'グルテンフリー', 'コーシャ', '乳製品不使用', 'ペスカタリアン'] },
        { id: "b_price", type: "select", label: "1名あたりの平均ご利用金額（目安）", dbColumn: "restaurant_price", required: false, options: ["500", "1000", "1500", "2000", "3000", "5000"] },
        { id: "b_desc", type: "textarea", label: "店舗紹介・おすすめメニュー", dbColumn: "description", required: false, placeholder: "お店の雰囲気や、学生に人気なメニューなど自由にご記入ください。" }
      ]
    },
    {
      id: "sec_5",
      title: "5. 設備・テイクアウト",
      description: "",
      blocks: [
        { id: "b_seats", type: "text", label: "総席数", dbColumn: "total_seats", required: false, placeholder: "例：30席" },
        { id: "b_stay", type: "select", label: "平均滞接時間", dbColumn: "avg_stay_time", required: false, options: ["〜15分", "15分〜30分", "30分〜1時間", "1時間以上"] },
        { id: "b_takeout", type: "radio", label: "テイクアウト（お持ち帰り）を行っている", dbColumn: "custom_fields.takeout_available_text", required: false, options: ["はい", "いいえ"] },
        { id: "b_tmenu", type: "text", label: "テイクアウト可能なメニュー", dbColumn: "takeout_menu", required: false, placeholder: "例：お弁当各種、カレー" },
        { id: "b_tmethod", type: "checkbox", label: "注文方法 (複数可)", dbColumn: "payment_methods", required: false, options: ['店頭注文', '電話注文', 'オンライン(Uber等)'] },
        { id: "b_atom", type: "radio", label: "地域通貨「アトム通貨」は使えますか？", dbColumn: "custom_fields.atom_currency_text", required: false, options: ["はい", "いいえ"] },
        { id: "b_notes", type: "textarea", label: "その他ご質問・ご要望", dbColumn: "admin_notes", required: false, placeholder: "ご不明点があればご自由にご記入ください。" }
      ]
    }
  ]
};

const ImagePickerBlock: React.FC<{ block: FormBlock; isEditing: boolean; onClick: () => void }> = ({ block, isEditing, onClick }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const triggerPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();           
    fileInputRef.current?.click(); 
  };

  return (
    <div onClick={onClick} className={`bg-white p-5 rounded-2xl border-2 transition cursor-pointer ${isEditing ? 'border-orange-500 shadow-md ring-4 ring-orange-50 scale-[1.01] z-20 relative' : 'border-gray-200 hover:border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold text-gray-700 mb-2 pointer-events-none">
            {block.label} {block.required && <span className="text-red-500">*</span>}
          </label>

          <div className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 text-gray-600 gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />

            {previewUrl ? (
              <div className="flex flex-col items-center gap-2 w-full px-4">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-48 rounded-lg border shadow-sm object-contain bg-white" 
                />
                <button 
                  onClick={triggerPicker} 
                  className="mt-2 text-xs font-bold bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition w-fit"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 cursor-pointer w-full h-full" onClick={triggerPicker}>
                <svg className="w-8 h-8 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-bold text-blue-600 hover:underline pointer-events-none">Tap to Upload or Take Photo</span>
                {block.placeholder && <span className="text-xs text-gray-400 pointer-events-none">{block.placeholder}</span>}
              </div>
            )}
          </div>
        </div>
        <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-2 py-1 rounded uppercase ml-4 flex-shrink-0 pointer-events-none">{block.type}</span>
      </div>
    </div>
  );
};

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
      // Single URL string from DB
      setPreviews([{ url: currentValue }]);
    } else if (Array.isArray(currentValue)) {
      // Handle array of Files or array of URL strings from DB
      const processedPreviews = currentValue.map((item: any) => {
        if (item instanceof File) {
          return { file: item, url: URL.createObjectURL(item) };
        } else if (typeof item === 'string' && item.startsWith('http')) {
          return { url: item };
        }
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
        if (combined.length < maxLimit) {
          combined.push({ file, url: URL.createObjectURL(file) });
        }
      }
      
      // We only pass back the actual new Files to the form data state so the uploader logic knows to upload them.
      // Existing string URLs don't need re-uploading.
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
      <input
        type="file"
        accept="image/*"
        multiple={isMultiple}
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />
      
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
                <button type="button" onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-md transform scale-0 group-hover:scale-100 transition-transform">
                  ✕
                </button>
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

export function RegistrationEditor() {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [history, setHistory] = useState<VersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [baseColumns, setBaseColumns] = useState<{id: string, label: string, dataType: string}[]>([]);
  const [dynamicColumns, setDynamicColumns] = useState<{id: string, label: string, category: string, dataType: string}[]>([]);

  const [editingBlock, setEditingBlock] = useState<{ sectionId: string; blockId: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop'); 

  const [showFieldManager, setShowFieldManager] = useState(false);
  const [newFieldId, setNewFieldId] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');
  const [isSavingField, setIsSavingField] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<{
    type: 'section' | 'block';
    sectionId: string;
    blockId?: string;
  } | null>(null);

  const dragSectionItem = useRef<number | null>(null);
  const dragSectionOverItem = useRef<number | null>(null);

  const dragBlockItem = useRef<{ sectionId: string; index: number } | null>(null);
  const dragBlockOverItem = useRef<{ sectionId: string; index: number } | null>(null);

  useEffect(() => { 
    fetchConfig(); 
  }, []);

  const fetchConfig = async () => {
    try {
      const [schemaRes, historyRes, filtersRes, catsRes, baseColsRes] = await Promise.all([
        supabase.from('site_settings').select('data').eq('id', 'registration_schema').maybeSingle(),
        supabase.from('site_settings').select('data').eq('id', 'registration_schema_history').maybeSingle(),
        supabase.from('filter_options').select('type, name'),
        supabase.from('custom_categories').select('name'),
        supabase.from('form_base_columns').select('id, label, data_type')
      ]);

      if (schemaRes.data?.data?.sections?.length > 0) {
        setSchema(schemaRes.data.data);
      } else {
        setSchema(BASELINE_SCHEMA); 
      }

      if (historyRes.data?.data?.versions) {
        setHistory(historyRes.data.data.versions);
      }

      if (baseColsRes.data) {
        setBaseColumns(baseColsRes.data.map(c => ({ id: c.id, label: c.label, dataType: c.data_type })));
      }

      const dynCols: {id: string, label: string, category: string, dataType: string}[] = [];
      if (filtersRes.data) {
        const types = Array.from(new Set(filtersRes.data.map(f => f.type)));
        types.forEach(t => dynCols.push({ id: t, label: `Tag Group: ${t.toUpperCase()}`, category: 'Master Tags', dataType: 'array' }));
      }
      if (catsRes.data) {
        dynCols.push({ id: 'other_options', label: 'Event Hub Categories (other_options)', category: 'Events', dataType: 'array' });
      }
      setDynamicColumns(dynCols);

    } catch (error) {
      console.error("Failed to load schema configuration:", error);
      if (!schema) setSchema(BASELINE_SCHEMA);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async () => {
    const cleanId = newFieldId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanId || !newFieldLabel) return alert("ID and Label are required.");
    
    setIsSavingField(true);
    const { error } = await supabase.from('form_base_columns').upsert({
      id: cleanId,
      label: newFieldLabel,
      data_type: newFieldType
    });

    setIsSavingField(false);
    if (error) {
      alert(`Error saving field: ${error.message}`);
    } else {
      setNewFieldId('');
      setNewFieldLabel('');
      fetchConfig(); 
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm(`Delete mapping for "${id}"? (This doesn't delete data, just removes it from the builder)`)) return;
    const { error } = await supabase.from('form_base_columns').delete().eq('id', id);
    if (error) alert(`Error deleting: ${error.message}`);
    else fetchConfig();
  };

  const saveConfig = async () => {
    if (!schema) return;
    setSaving(true);
    const newVersion: VersionHistory = { timestamp: new Date().toISOString(), schema };
    const updatedHistory = [newVersion, ...history].slice(0, 15);
    
    try {
      await Promise.all([
        supabase.from('site_settings').upsert({ id: 'registration_schema', data: schema }),
        supabase.from('site_settings').upsert({ id: 'registration_schema_history', data: { versions: updatedHistory } })
      ]);

      setHistory(updatedHistory);
      alert('Form Schema Saved Successfully!');
    } catch (error) {
      console.error("Failed to save schema:", error);
      alert('Failed to save schema. Please check the console for details.');
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = (archivedSchema: FormSchema) => {
    if (confirm("Restore this version? Make sure to click Publish to save it.")) {
      setSchema(archivedSchema);
      setShowHistoryModal(false);
      setEditingBlock(null);
      setIsSidebarOpen(false);
    }
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const getUsedColumns = (blocks: FormBlock[]): string[] => {
    let used: string[] = [];
    blocks.forEach(b => {
      used.push(b.dbColumn);
      if (b.conditions) {
        b.conditions.forEach(c => used.push(...getUsedColumns(c.blocks)));
      }
    });
    return used;
  };
  const usedColumns = schema ? schema.sections.flatMap(s => getUsedColumns(s.blocks)) : [];

  const mutateBlockTree = (blocks: FormBlock[], mutator: (b: FormBlock) => FormBlock | null): FormBlock[] => {
    return blocks.map(b => {
      const updated = mutator(b);
      if (!updated) return null; 
      if (updated.conditions && updated.conditions.length > 0) {
        return {
          ...updated,
          conditions: updated.conditions.map(c => ({
            ...c,
            blocks: mutateBlockTree(c.blocks, mutator)
          }))
        };
      }
      return updated;
    }).filter(Boolean) as FormBlock[];
  };

  const confirmDelete = () => {
    if (!pendingDelete || !schema) return;
    setSchema(prev => {
      if (!prev) return prev;
      const newSections = [...prev.sections];
      if (pendingDelete.type === 'section') {
        return { ...prev, sections: newSections.filter(s => s.id !== pendingDelete.sectionId) };
      } 
      if (pendingDelete.type === 'block') {
        return {
          ...prev,
          sections: newSections.map(s => {
            if (s.id !== pendingDelete.sectionId) return s;
            return {
              ...s,
              blocks: mutateBlockTree(s.blocks, b => b.id === pendingDelete.blockId ? null : b)
            };
          })
        };
      }
      return prev;
    });

    if (editingBlock?.blockId === pendingDelete.blockId) {
      setEditingBlock(null);
      setIsSidebarOpen(false);
    }
    setPendingDelete(null);
  };

  const addSection = () => {
    if (!schema) return;
    setSchema({ ...schema, sections: [...schema.sections, { id: generateId(), title: 'New Section', description: '', blocks: [] }] });
  };

  const updateSection = (id: string, key: 'title' | 'description', value: string) => {
    if (!schema) return;
    setSchema({ ...schema, sections: schema.sections.map(s => s.id === id ? { ...s, [key]: value } : s) });
  };

  const handleSectionSort = () => {
    if (!schema || dragSectionItem.current === null || dragSectionOverItem.current === null) return;
    const sections = [...schema.sections];
    const draggedItemContent = sections.splice(dragSectionItem.current, 1)[0];
    sections.splice(dragSectionOverItem.current, 0, draggedItemContent);
    dragSectionItem.current = null;
    dragSectionOverItem.current = null;
    setSchema({ ...schema, sections });
  };

  const handleBlockSort = (e: React.DragEvent, sectionId: string) => {
    e.stopPropagation(); 
    if (!schema || !dragBlockItem.current || !dragBlockOverItem.current) return;
    
    if (dragBlockItem.current.sectionId !== dragBlockOverItem.current.sectionId) return;

    const targetSectionId = dragBlockItem.current.sectionId;
    const sectionIndex = schema.sections.findIndex(s => s.id === targetSectionId);
    if (sectionIndex === -1) return;

    const newSections = [...schema.sections];
    const blocks = [...newSections[sectionIndex].blocks];

    const draggedItemContent = blocks.splice(dragBlockItem.current.index, 1)[0];
    blocks.splice(dragBlockOverItem.current.index, 0, draggedItemContent);

    newSections[sectionIndex] = { ...newSections[sectionIndex], blocks };

    setSchema({ ...schema, sections: newSections });

    dragBlockItem.current = null;
    dragBlockOverItem.current = null;
  };

  const createNewBlock = (type: BlockType): FormBlock => ({
    id: generateId(), type, label: `New ${type}`, required: false, dbColumn: type === 'image_upload' ? 'image_url' : `custom_fields.${generateId()}`,
    options: ['Option 1', 'Option 2'], content: '<p>Edit your text here.</p>', isPublicCustomField: true, maxImages: type === 'image_upload' ? 1 : undefined
  });

  const addBlockToSection = (sectionId: string, type: BlockType) => {
    if (!schema) return;
    const newBlock = createNewBlock(type);
    setSchema({ ...schema, sections: schema.sections.map(s => s.id === sectionId ? { ...s, blocks: [...s.blocks, newBlock] } : s) });
    setEditingBlock({ sectionId, blockId: newBlock.id });
    setIsSidebarOpen(true);
  };

  const addBlockToCondition = (sectionId: string, parentBlockId: string, triggerValue: string, type: BlockType) => {
    if (!schema) return;
    setSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(s => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            blocks: mutateBlockTree(s.blocks, b => {
              if (b.id !== parentBlockId) return b;
              const newChild = createNewBlock(type);
              const existingConditions = b.conditions || [];
              const conditionIndex = existingConditions.findIndex(c => c.triggerValue === triggerValue);

              if (conditionIndex > -1) {
                const updatedConditions = [...existingConditions];
                updatedConditions[conditionIndex] = {
                  ...updatedConditions[conditionIndex],
                  blocks: [...updatedConditions[conditionIndex].blocks, newChild]
                };
                return { ...b, conditions: updatedConditions };
              } else {
                return { ...b, conditions: [...existingConditions, { triggerValue, blocks: [newChild] }] };
              }
            })
          };
        })
      };
    });
  };

  const updateBlock = (sectionId: string, blockId: string, updates: Partial<FormBlock>) => {
    if (!schema) return;
    setSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(s => {
          if (s.id !== sectionId) return s;
          return {
             ...s,
             blocks: mutateBlockTree(s.blocks, b => b.id === blockId ? { ...b, ...updates } : b)
          }
        })
      };
    });
  };

  const renderCanvasBlock = (block: FormBlock, sectionId: string, index: number = -1, isNested: boolean = false) => {
    const isEditing = editingBlock?.blockId === block.id;

    if (block.type === 'image_upload') {
      return (
        <div 
          key={block.id} 
          className={`mb-3 relative ${!isNested ? 'group' : ''}`}
          draggable={!isNested}
          onDragStart={(e) => {
            if (!isNested && index !== -1) {
              e.stopPropagation();
              dragBlockItem.current = { sectionId, index };
            }
          }}
          onDragEnter={(e) => {
            if (!isNested && index !== -1) {
              e.stopPropagation();
              dragBlockOverItem.current = { sectionId, index };
            }
          }}
          onDragEnd={(e) => {
            if (!isNested) handleBlockSort(e, sectionId);
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          {!isNested && (
            <div className="absolute top-1/2 -left-4 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-move text-gray-300 hover:text-orange-500 z-30 p-1 font-black transition-opacity" title="Drag to reorder block">
              ⋮⋮
            </div>
          )}
          <ImagePickerBlock 
            block={block} 
            isEditing={isEditing} 
            onClick={() => { setEditingBlock({ sectionId, blockId: block.id }); setIsSidebarOpen(true); }} 
          />
        </div>
      );
    }

    return (
      <div 
        key={block.id} 
        className={`mb-3 relative ${!isNested ? 'group' : ''}`}
        draggable={!isNested}
        onDragStart={(e) => {
          if (!isNested && index !== -1) {
            e.stopPropagation();
            dragBlockItem.current = { sectionId, index };
          }
        }}
        onDragEnter={(e) => {
          if (!isNested && index !== -1) {
            e.stopPropagation();
            dragBlockOverItem.current = { sectionId, index };
          }
        }}
        onDragEnd={(e) => {
          if (!isNested) {
            handleBlockSort(e, sectionId);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {!isNested && (
          <div className="absolute top-1/2 -left-4 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-move text-gray-300 hover:text-orange-500 z-30 p-1 font-black transition-opacity" title="Drag to reorder block">
            ⋮⋮
          </div>
        )}

        <div onClick={() => { setEditingBlock({ sectionId, blockId: block.id }); setIsSidebarOpen(true); }} className={`bg-white p-5 rounded-2xl border-2 transition cursor-pointer ${isEditing ? 'border-orange-500 shadow-md ring-4 ring-orange-50 scale-[1.01] z-20 relative' : 'border-gray-200 hover:border-gray-300'}`}>
          <div className="flex justify-between items-start pointer-events-none">
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-2">{block.label} {block.required && <span className="text-red-500">*</span>}</label>
              
              {block.type === 'hours_source' && (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                   {block.options?.map(opt => <div key={opt} className="p-3 rounded-xl border-2 border-gray-200 text-center font-bold text-gray-600 text-sm">{opt}</div>)}
                 </div>
              )}

              {block.type === 'operating_hours' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                   {DAYS.map(day => (
                     <div key={day} className="flex items-center bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                        <span className="w-20 font-bold text-gray-700 text-xs">{day}</span>
                        <span className="text-gray-300 text-xs">11:00〜20:00</span>
                     </div>
                   ))}
                 </div>
              )}

              {block.type === 'text' && <div className="h-10 bg-gray-50 border border-gray-100 rounded-lg w-full px-3 flex items-center text-gray-400 text-sm">{block.placeholder || ''}</div>}
              {block.type === 'textarea' && <div className="h-20 bg-gray-50 border border-gray-100 rounded-lg w-full p-3 text-gray-400 text-sm">{block.placeholder || ''}</div>}
              {block.type === 'select' && <div className="h-10 bg-gray-50 border border-gray-100 rounded-lg w-full flex items-center px-3 text-gray-400 text-sm">Dropdown...</div>}
              
              {(block.type === 'checkbox' || block.type === 'radio' || block.type === 'photo_method') && (
                 <div className="flex flex-wrap gap-2 mt-2">
                   {block.options?.map((opt, i) => <div key={i} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg font-bold shadow-sm">{opt}</div>)}
                 </div>
              )}
              
              {block.type === 'html' && <div className="prose prose-sm text-gray-500 bg-amber-50 p-3 rounded-lg border border-amber-100" dangerouslySetInnerHTML={{ __html: block.content || '' }} />}
            </div>
            <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-2 py-1 rounded uppercase ml-4 flex-shrink-0">{block.type}</span>
          </div>
        </div>

        {block.conditions?.map(cond => (
          <div key={cond.triggerValue} className="mt-3 ml-6 pl-4 border-l-4 border-purple-300 relative bg-purple-50/30 rounded-r-2xl py-2">
             <span className="absolute -left-3 top-4 bg-purple-600 text-white shadow-sm text-[10px] font-black px-2 py-0.5 rounded-full">IF: {cond.triggerValue}</span>
             {cond.blocks.map((child, childIdx) => renderCanvasBlock(child, sectionId, childIdx, true))}
          </div>
        ))}
      </div>
    );
  };

  let activeEditingBlockProps: FormBlock | null = null;
  if (schema && editingBlock) {
    const findBlock = (blocks: FormBlock[]): FormBlock | null => {
      for (const b of blocks) {
        if (b.id === editingBlock.blockId) return b;
        if (b.conditions) {
          for (const c of b.conditions) {
            const found = findBlock(c.blocks);
            if (found) return found;
          }
        }
      }
      return null;
    };
    for (const s of schema.sections) {
      if (s.id === editingBlock.sectionId) {
        activeEditingBlockProps = findBlock(s.blocks);
        break;
      }
    }
  }

  const BlockPropertiesEditor = ({ block, sectionId }: { block: FormBlock, sectionId: string }) => {
    const [local, setLocal] = useState(block);
    
    useEffect(() => { setLocal(block); }, [block.id]);

    const handleBlur = () => { updateBlock(sectionId, block.id, local); };

    const handleOptionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocal({ ...local, options: e.target.value.split('\n') });
    };

    const handleOptionsBlur = () => {
      const newOptions = (local.options || []).map(s => s.trim()).filter(Boolean);
      const oldOptions = block.options || [];
      
      const newConditions = (block.conditions || []).map(cond => {
        const oldIndex = oldOptions.indexOf(cond.triggerValue);
        if (oldIndex !== -1 && newOptions[oldIndex]) {
           return { ...cond, triggerValue: newOptions[oldIndex] };
        }
        return cond;
      });

      const updated = { ...local, options: newOptions, conditions: newConditions };
      setLocal(updated);
      updateBlock(sectionId, block.id, updated);
    };

    const isCustomField = local.dbColumn.startsWith('custom_fields.');
    
    const blockExpectedType = block.type === 'checkbox' ? 'array' : 'string';

    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b pb-4">
           <span className="bg-orange-100 text-orange-800 text-xs font-black px-2 py-1 rounded uppercase">{block.type}</span>
           <button onClick={() => setPendingDelete({ type: 'block', sectionId, blockId: block.id })} className="text-red-500 text-sm font-bold hover:underline">Delete Block</button>
        </div>

        {block.type !== 'html' && (
          <>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Display Label</label>
              <input type="text" value={local.label} onChange={e => setLocal({...local, label: e.target.value})} onBlur={handleBlur} className="w-full p-3 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            
            {block.type !== 'image_upload' && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Placeholder</label>
                <input type="text" value={local.placeholder || ''} onChange={e => setLocal({...local, placeholder: e.target.value})} onBlur={handleBlur} className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            )}

            {block.type === 'image_upload' && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Help Text / Hint</label>
                <input type="text" value={local.placeholder || ''} onChange={e => setLocal({...local, placeholder: e.target.value})} onBlur={handleBlur} className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Max file size: 5MB" />
              </div>
            )}
            
            {block.type === 'text' && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Validation Rule</label>
                <select value={local.validation || 'none'} onChange={e => { const val = e.target.value as any; setLocal({...local, validation: val}); updateBlock(sectionId, block.id, { validation: val }); }} className="w-full p-3 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="none">None (Standard Text)</option>
                  <option value="email">Email Address</option>
                  <option value="url">Website URL</option>
                  <option value="number">Number Only</option>
                  <option value="phone">Phone Number</option>
                </select>
              </div>
            )}

            <label className="flex items-center cursor-pointer p-3 bg-gray-50 border rounded-xl hover:bg-gray-100 transition">
              <input type="checkbox" checked={local.required} onChange={e => { setLocal({...local, required: e.target.checked}); updateBlock(sectionId, block.id, { required: e.target.checked }); }} className="w-5 h-5 accent-orange-500 mr-3" />
              <span className="font-bold text-gray-700">Required Field</span>
            </label>
          </>
        )}

        {block.type === 'html' && (
          <div>
             <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Raw HTML / Markdown</label>
             <textarea rows={10} value={local.content || ''} onChange={e => setLocal({...local, content: e.target.value})} onBlur={handleBlur} className="w-full p-4 bg-gray-900 text-green-400 font-mono text-sm rounded-xl outline-none" placeholder="<p>Enter text...</p>" />
          </div>
        )}

        {['select', 'checkbox', 'radio', 'hours_source', 'photo_method'].includes(block.type) && (
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Options (One per line)</label>
            <textarea rows={6} value={(local.options || []).join('\n')} onChange={handleOptionsChange} onBlur={handleOptionsBlur} className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500 whitespace-pre" />
          </div>
        )}

        {['select', 'checkbox', 'radio', 'hours_source', 'photo_method'].includes(block.type) && (
          <div className="pt-6 border-t border-gray-200">
             <h4 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-4">Conditional Logic</h4>
             <p className="text-xs text-gray-500 mb-4 font-medium">Attach follow-up questions when a user selects specific options below.</p>
             {block.options?.map(opt => {
                const condition = block.conditions?.find(c => c.triggerValue === opt);
                return (
                  <div key={opt} className="mb-4 bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <span className="font-bold text-sm text-purple-900 block mb-2">If user selects: "{opt}"</span>
                    <div className="space-y-2">
                      {condition?.blocks.map(child => (
                         <div key={child.id} className="flex justify-between items-center bg-white border border-purple-200 p-2 rounded-lg text-xs font-bold text-gray-700 shadow-sm">
                           <span>↳ {child.label} <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded ml-1">{child.type}</span></span>
                           <button onClick={() => setEditingBlock({sectionId, blockId: child.id})} className="text-purple-600 hover:underline">Edit</button>
                         </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => addBlockToCondition(sectionId, block.id, opt, 'operating_hours')} className="text-[10px] font-black uppercase tracking-wider bg-white border border-purple-200 text-purple-700 px-2 py-1.5 rounded hover:bg-purple-100">+ Add 7-Day Grid</button>
                      <button onClick={() => addBlockToCondition(sectionId, block.id, opt, 'text')} className="text-[10px] font-black uppercase tracking-wider bg-white border border-purple-200 text-purple-700 px-2 py-1.5 rounded hover:bg-purple-100">+ Add Text Input</button>
                    </div>
                  </div>
                )
             })}
          </div>
        )}

        <div className="pt-6 border-t border-gray-200 bg-blue-50/50 -mx-6 px-6 pb-6 mt-6 border-b">
          <label className="block text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Smart Database Mapping</label>
          <p className="text-xs font-medium text-blue-800 mb-4">Select where this question's data should be saved.</p>
          
          <select 
            value={local.dbColumn === 'NEW_CUSTOM' ? '' : local.dbColumn}
            onChange={e => {
              const val = e.target.value;
              if (val === 'NEW_CUSTOM') {
                const name = prompt('Enter a unique ID for your new custom field (e.g. wifi_info, budget_lunch):');
                if (name) {
                  const formattedName = `custom_fields.${name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
                  setLocal({...local, dbColumn: formattedName, maxImages: 1});
                  updateBlock(sectionId, block.id, { dbColumn: formattedName, maxImages: 1 });
                }
              } else {
                const selectedCol = [...baseColumns, ...dynamicColumns].find(c => c.id === val);
                const isArray = selectedCol?.dataType === 'array';
                const newMax = isArray ? 5 : 1;
                
                setLocal({...local, dbColumn: val, maxImages: newMax});
                updateBlock(sectionId, block.id, { dbColumn: val, maxImages: newMax });
              }
            }}
            className="w-full p-3 bg-white border border-blue-200 text-gray-900 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <optgroup label="Standard Columns">
              {baseColumns.map(col => {
                const isTypeMatch = col.dataType === blockExpectedType || (block.type === 'image_upload');
                const isUsed = usedColumns.includes(col.id) && col.id !== local.dbColumn;
                const disabled = isUsed || !isTypeMatch;
                const labelSuffix = isUsed ? '(In Use)' : (!isTypeMatch ? '(Type Mismatch)' : '');
                
                return (
                  <option key={col.id} value={col.id} disabled={disabled}>
                    {col.label} {labelSuffix}
                  </option>
                );
              })}
            </optgroup>
            
            <optgroup label="Dynamic Master Tags">
              {dynamicColumns.map(col => {
                const isTypeMatch = col.dataType === blockExpectedType;
                const isUsed = usedColumns.includes(col.id) && col.id !== local.dbColumn;
                const disabled = isUsed || !isTypeMatch;
                const labelSuffix = isUsed ? '(In Use)' : (!isTypeMatch ? '(Type Mismatch)' : '');

                return (
                  <option key={col.id} value={col.id} disabled={disabled}>
                    {col.label} {labelSuffix}
                  </option>
                );
              })}
            </optgroup>

            <optgroup label="Custom Fields">
               {isCustomField && <option value={local.dbColumn}>{local.dbColumn} (Current Custom)</option>}
               <option value="NEW_CUSTOM">+ Create New Custom Field...</option>
            </optgroup>
          </select>

          {block.type === 'image_upload' && local.maxImages !== undefined && local.maxImages > 1 && (
            <div className="mt-4 p-4 bg-white border border-blue-100 rounded-xl shadow-sm animate-in fade-in">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Gallery Limit</span>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Auto-detected Array</span>
              </div>
              <p className="text-xs text-gray-500 mb-3 font-medium">How many images can the user upload here?</p>
              <input 
                type="number" 
                min="2" 
                max="20"
                value={local.maxImages} 
                onChange={e => {
                  const max = parseInt(e.target.value) || 2;
                  setLocal({...local, maxImages: max});
                  updateBlock(sectionId, block.id, { maxImages: max });
                }} 
                className="w-full p-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          )}

          {isCustomField && (
            <div className="mt-4 p-4 bg-white border border-blue-100 rounded-xl shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Custom Field Visibility</span>
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={local.isPublicCustomField !== false} 
                  onChange={e => {
                    setLocal({...local, isPublicCustomField: e.target.checked}); 
                    updateBlock(sectionId, block.id, { isPublicCustomField: e.target.checked });
                  }} 
                  className="w-5 h-5 accent-blue-600 mr-3" 
                />
                <span className="font-bold text-sm text-gray-700">Make Public (Show on Web & Cards)</span>
              </label>
              <p className="text-xs text-gray-500 mt-2 font-medium">If unchecked, data saved here will only be visible to Admins in the CMS.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-10 font-bold text-gray-500 animate-pulse">Loading Builder Engine...</div>;
  if (!schema) return <div className="p-10 font-bold text-red-500">Error loading builder. Please refresh the page.</div>;

  const getViewportWidth = () => {
    if (viewport === 'mobile') return 'max-w-md';
    if (viewport === 'tablet') return 'max-w-3xl';
    return 'max-w-4xl';
  };

  return (
    <div className="flex justify-center mx-auto items-start min-h-screen relative bg-gray-100 pb-40">
      
      <div className={`w-full transition-all duration-300 ${isSidebarOpen ? 'mr-[400px]' : ''} flex flex-col items-center p-6`}>
        
        <div className="flex justify-between items-center mb-8 sticky top-4 z-40 bg-white/90 backdrop-blur-md p-4 rounded-[24px] shadow-sm border border-gray-200 w-full max-w-5xl">
          <div><h2 className="text-xl font-black text-gray-900 tracking-tight">Form Builder</h2></div>
          <div className="flex items-center gap-4">
            
            <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
               <button onClick={() => setViewport('mobile')} className={`px-3 py-1.5 text-xs font-black rounded-md transition ${viewport === 'mobile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>Mobile</button>
               <button onClick={() => setViewport('tablet')} className={`px-3 py-1.5 text-xs font-black rounded-md transition ${viewport === 'tablet' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>Tablet</button>
               <button onClick={() => setViewport('desktop')} className={`px-3 py-1.5 text-xs font-black rounded-md transition ${viewport === 'desktop' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>Desktop</button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>
            
            <button onClick={() => setShowFieldManager(true)} className="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-full font-bold text-sm hover:bg-blue-100 transition flex items-center gap-2">
              ⚙️ Manage DB Fields
            </button>
            <button onClick={() => setShowHistoryModal(true)} className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-full font-bold text-sm hover:bg-amber-100 transition">History</button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`px-4 py-2 rounded-full font-bold text-sm transition ${isSidebarOpen ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Properties</button>
            <button onClick={saveConfig} disabled={saving} className="bg-orange-600 text-white px-6 py-2 rounded-full font-black text-sm hover:bg-orange-700 shadow-md transition disabled:opacity-50">{saving ? 'Saving...' : 'Publish'}</button>
          </div>
        </div>

        <div className={`w-full transition-all duration-300 ${getViewportWidth()} space-y-6`}>
          <div className="bg-white p-8 rounded-[32px] border border-gray-200 shadow-sm relative z-10">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Global Form Header</label>
            <input type="text" value={schema.pageTitle} onChange={e => setSchema({...schema, pageTitle: e.target.value})} className="w-full text-3xl md:text-4xl font-black mb-4 outline-none placeholder-gray-300" placeholder="Page Title" />
            <textarea rows={6} value={schema.pageDescription} onChange={e => setSchema({...schema, pageDescription: e.target.value})} className="w-full text-gray-600 font-medium outline-none resize-none placeholder-gray-300" placeholder="Page Description (supports newlines)" />
          </div>

          {schema.sections.map((section, index) => (
            <div key={section.id} draggable onDragStart={(e) => { dragSectionItem.current = index; }} onDragEnter={() => (dragSectionOverItem.current = index)} onDragEnd={handleSectionSort} className="bg-white p-6 rounded-[32px] border-2 border-transparent hover:border-orange-200 shadow-sm transition relative group z-10">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-200 cursor-move">Drag to reorder section</span>
                <button onClick={() => setPendingDelete({ type: 'section', sectionId: section.id })} className="bg-red-100 text-red-600 w-8 h-8 rounded-full font-bold flex items-center justify-center hover:bg-red-200">✕</button>
              </div>

              <input type="text" value={section.title} onChange={e => updateSection(section.id, 'title', e.target.value)} className="w-full text-2xl font-black bg-transparent outline-none mb-2 text-gray-900" placeholder="Section Title" />
              <input type="text" value={section.description} onChange={e => updateSection(section.id, 'description', e.target.value)} className="w-full text-sm font-bold bg-transparent outline-none mb-6 text-gray-500" placeholder="Section Description (Optional)" />

              <div className="mt-6">
                {section.blocks.map((block, idx) => renderCanvasBlock(block, section.id, idx))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-4 cursor-default">
                <span className="text-xs font-bold text-gray-400 py-1 mr-2">Add Element:</span>
                <button onClick={() => addBlockToSection(section.id, 'text')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Text</button>
                <button onClick={() => addBlockToSection(section.id, 'textarea')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Textarea</button>
                <button onClick={() => addBlockToSection(section.id, 'checkbox')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Checkboxes</button>
                <button onClick={() => addBlockToSection(section.id, 'radio')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Radio</button>
                <button onClick={() => addBlockToSection(section.id, 'select')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Dropdown</button>
                <button onClick={() => addBlockToSection(section.id, 'html')} className="text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition">+ HTML Block</button>
                
                <span className="text-xs font-bold text-gray-400 py-1 ml-4 mr-2 border-l pl-4">Custom UI:</span>
                <button onClick={() => addBlockToSection(section.id, 'image_upload')} className="text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">+ Image/Camera</button>
                <button onClick={() => addBlockToSection(section.id, 'hours_source')} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition">+ Hours Toggle</button>
                <button onClick={() => addBlockToSection(section.id, 'operating_hours')} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition">+ 7-Day Grid</button>
                <button onClick={() => addBlockToSection(section.id, 'photo_method')} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition">+ Photo Cards</button>
              </div>
            </div>
          ))}

          <button onClick={addSection} className="w-full py-8 border-4 border-dashed border-gray-300 rounded-[32px] text-gray-400 font-black text-xl hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 transition flex items-center justify-center gap-3 relative z-10">
            <span className="text-3xl">+</span> ADD NEW SECTION
          </button>
        </div>
      </div>

      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="bg-gray-900 text-white p-6 shrink-0 flex justify-between items-center">
          <h3 className="text-lg font-black tracking-widest">PROPERTIES</h3>
          <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white text-2xl font-black w-8 h-8 rounded-full hover:bg-gray-800 flex items-center justify-center transition">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 pb-20">
          {!editingBlock || !activeEditingBlockProps ? (
            <div className="text-center text-gray-400 font-bold mt-20">Click an element on the canvas to edit its properties.</div>
          ) : (
            <BlockPropertiesEditor key={activeEditingBlockProps.id} block={activeEditingBlockProps} sectionId={editingBlock.sectionId} />
          )}
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-red-100">
            <h3 className="text-2xl font-black text-red-600 mb-2">Destructive Action Warning</h3>
            <p className="text-gray-700 mb-6 font-medium leading-relaxed">
              Are you sure you want to delete this {pendingDelete.type}? 
              <br/><br/>
              <strong className="text-red-600 bg-red-50 px-2 py-1 rounded">Data Loss Notice:</strong> Existing restaurants may have data saved against this field in Supabase. Deleting it here will hide the data from the UI.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setPendingDelete(null)} className="px-5 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-3 font-black bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition">Yes, Delete It</button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-amber-500 p-6 flex justify-between items-center text-white">
              <h2 className="text-xl font-black">Version History</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-2xl font-black hover:text-amber-200">✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 bg-gray-50 flex-1">
              <button onClick={() => restoreVersion(BASELINE_SCHEMA)} className="w-full text-left p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition mb-4">
                 <div className="font-black text-amber-900 text-lg">Original Form (Baseline)</div>
                 <div className="text-sm font-bold text-amber-700">Restore to the factory default schema.</div>
              </button>
              
              {history.length === 0 && <p className="text-center text-gray-500 font-bold py-10">No history available yet.</p>}
              
              {history.map((ver, idx) => (
                <button key={idx} onClick={() => restoreVersion(ver.schema)} className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-400 transition flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-900">{new Date(ver.timestamp).toLocaleDateString()} at {new Date(ver.timestamp).toLocaleTimeString()}</div>
                    <div className="text-xs font-bold text-gray-400 mt-1">{ver.schema.sections.length} Sections</div>
                  </div>
                  <span className="text-sm font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Restore</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showFieldManager && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="bg-blue-600 p-6 flex justify-between items-center text-white">
              <div>
                <h2 className="text-xl font-black">Database Field Manager</h2>
                <p className="text-blue-200 text-xs font-bold mt-1">Manage the columns available in the Form Builder dropdown.</p>
              </div>
              <button onClick={() => setShowFieldManager(false)} className="text-2xl font-black hover:text-blue-200 transition">✕</button>
            </div>
            
            <div className="p-6 bg-blue-50/50 border-b border-gray-200">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Add New Database Mapping</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="db_column_name" className="flex-1 p-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 font-mono" />
                <input type="text" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="Display Label (e.g. TikTok Link)" className="flex-1 p-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
                <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} className="p-3 border border-gray-200 rounded-xl text-sm font-bold outline-none bg-white">
                  <option value="string">Text/String</option>
                  <option value="number">Number</option>
                  <option value="array">Multiple (Array)</option>
                  <option value="boolean">Checkbox (True/False)</option>
                </select>
                <button onClick={handleAddField} disabled={isSavingField} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  {isSavingField ? '...' : 'Add'}
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Currently Mapped Fields ({baseColumns.length})</h3>
              <div className="space-y-3">
                {baseColumns.length === 0 && <p className="text-center text-gray-400 font-bold py-8">No standard columns mapped yet.</p>}
                
                {baseColumns.map(col => (
                  <div key={col.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div>
                      <div className="font-bold text-gray-900">{col.label}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">{col.id}</span>
                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">{col.dataType}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteField(col.id)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RegisterRestaurant() {
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
      } catch (err: any) {
        setSchema(BASELINE_SCHEMA);
      }
    };
    fetchData();
  }, []);

  // --- DELTA UPDATE LIVE SEARCH LOGIC ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1 && !updateTargetId) {
        setIsSearching(true);
        // Only fetching safe search identifiers here
        const { data } = await supabase
          .from('restaurants')
          .select('id, title, address')
          .eq('status', 'approved')
          .ilike('title', `%${searchQuery}%`)
          .limit(10);
        
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

    // SECURE: Strict selection to prevent private data leaks (contact info, admin notes, etc.)
    const { data, error } = await supabase
      .from('restaurants')
      .select(SAFE_UPDATE_COLUMNS)
      .eq('id', restaurant.id)
      .single();
    
    setLoading(false);
    if (data) {
      const newFormData: any = {};
      
      // Map standard safe columns
      Object.keys(data).forEach(key => {
        if (key !== 'custom_fields' && key !== 'other_options') {
          newFormData[key] = data[key];
        }
      });

      // Map custom JSON fields back to dot.notation keys
      if (data.custom_fields) {
        Object.keys(data.custom_fields).forEach(key => {
          newFormData[`custom_fields.${key}`] = data.custom_fields[key];
        });
      }

      // Default the hours source if it wasn't strictly set previously
      if (!newFormData.hours_source) {
        newFormData.hours_source = data.operating_hours || 'Googleマップと同じ';
      }

      setFormData(newFormData);
      setSelectedEvents(data.other_options || []);
    } else if (error) {
      setMessage(`データの取得に失敗しました: ${error.message}`);
    }
  };

  const handleInputChange = (dbColumn: string, value: any) => {
    setFormData(prev => ({ ...prev, [dbColumn]: value }));
  };

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
    
    // Attach delta update tags if applicable
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

        if (key.startsWith('custom_fields.')) {
          payload.custom_fields[key.replace('custom_fields.', '')] = finalUrlData;
        } else {
          payload[key] = finalUrlData;
        }
        continue;
      }

      if (key.startsWith('custom_fields.')) {
        payload.custom_fields[key.replace('custom_fields.', '')] = value;
      } else {
        payload[key] = value;
      }
    }

    let finalHours: any = '';
    const hSource = formData['hours_source'];
    
    if (hSource === 'ここで手動で入力する') {
      const hoursObj: Record<string, string> = {};
      DAYS.forEach(day => {
        hoursObj[day] = formData[`hours_${day}`] || '';
      });
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
            <label className="block text-sm font-bold text-gray-700 mb-4">{block.label} {block.required && <span className="text-red-5