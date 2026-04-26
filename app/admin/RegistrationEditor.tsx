'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

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

// Standard base columns now strictly typed
const BASE_COLUMNS = [
  { id: 'title', label: '店舗名 (Title)', dataType: 'string' },
  { id: 'description', label: '店舗紹介 (Description)', dataType: 'string' },
  { id: 'address', label: '住所 (Address)', dataType: 'string' },
  { id: 'restaurant_price', label: '平均予算 (Price)', dataType: 'string' },
  { id: 'total_seats', label: '総席数 (Total Seats)', dataType: 'string' },
  { id: 'avg_stay_time', label: '滞在時間 (Stay Time)', dataType: 'string' },
  { id: 'takeout_menu', label: 'テイクアウトメニュー (Takeout Menu)', dataType: 'string' },
  { id: 'operating_hours', label: '営業時間 (Operating Hours)', dataType: 'string' },
  { id: 'hours_source', label: '営業時間ソース (Hours Source)', dataType: 'string' },
  { id: 'image_url', label: '店舗画像 (Main Image URL)', dataType: 'string' },
  { id: 'contact_name', label: '担当者名 (Contact Name) - PRIVATE', dataType: 'string' },
  { id: 'contact_phone', label: '電話番号 (Contact Phone) - PRIVATE', dataType: 'string' },
  { id: 'contact_email', label: 'メールアドレス (Contact Email) - PRIVATE', dataType: 'string' },
  { id: 'photo_method', label: '写真提供方法 (Photo Method) - PRIVATE', dataType: 'string' },
  { id: 'admin_notes', label: '管理者メモ (Admin Notes) - PRIVATE', dataType: 'string' }
];

const BASELINE_SCHEMA: FormSchema = {
  pageTitle: "ワセメシ情報ご提供のお願い",
  pageDescription: "私たちは早稲田大学国際教養学部の「イートチーム」と申します。\n「ワセメシ」の魅力をもっと多くの方に知っていただき、地域のお店と学生・観光客をつなぐ多言語対応のレストラン検索サイト「イートダキマス」を作成しています。\n\n・ 掲載はすべて無料です\n・ 頂いた情報を元に、こちらで多言語（英語等）に翻訳して掲載します\n・ 所要時間は5〜10分程度です",
  sections: [
    {
      id: "sec_1",
      title: "1. 店舗の基本情報",
      description: "",
      blocks: [
        { id: "b_title", type: "text", label: "店舗名 (Web公開)", dbColumn: "title", required: true, placeholder: "例：いねや本館" },
        { id: "b_cname", type: "text", label: "ご担当者名 (非公開)", dbColumn: "contact_name", required: false, placeholder: "例：早稲田 太郎" },
        { id: "b_cphone", type: "text", label: "電話番号 (非公開)", dbColumn: "contact_phone", required: false, placeholder: "例：03-1234-5678", validation: "phone" },
        { id: "b_cemail", type: "text", label: "メールアドレス (非公開)", dbColumn: "contact_email", required: false, placeholder: "例：shop@example.com", validation: "email" },
        { id: "b_address", type: "text", label: "住所 (Web公開)", dbColumn: "address", required: false, placeholder: "例：東京都新宿区西早稲田1-2-3" }
      ]
    }
  ]
};

// --- NEW COMPONENT: Interactive Image Picker ---
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
    e.stopPropagation(); // Prevents the click from just selecting the block
    onClick();           // Selects the block in the editor properties
    fileInputRef.current?.click(); // Opens the file picker
  };

  return (
    <div onClick={onClick} className={`bg-white p-5 rounded-2xl border-2 transition cursor-pointer ${isEditing ? 'border-orange-500 shadow-md ring-4 ring-orange-50 scale-[1.01] z-20 relative' : 'border-gray-200 hover:border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold text-gray-700 mb-2 pointer-events-none">
            {block.label} {block.required && <span className="text-red-500">*</span>}
          </label>

          <div className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 text-gray-600 gap-3">
            {/* Hidden Input */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
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
// ----------------------------------------------


export default function RegistrationEditor() {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [history, setHistory] = useState<VersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dynamic Master Tags from DB now typed as arrays
  const [dynamicColumns, setDynamicColumns] = useState<{id: string, label: string, category: string, dataType: string}[]>([]);

  const [editingBlock, setEditingBlock] = useState<{ sectionId: string; blockId: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop'); 

  const [pendingDelete, setPendingDelete] = useState<{
    type: 'section' | 'block';
    sectionId: string;
    blockId?: string;
  } | null>(null);

  // Refs for Section Dragging
  const dragSectionItem = useRef<number | null>(null);
  const dragSectionOverItem = useRef<number | null>(null);

  // Refs for Block Dragging
  const dragBlockItem = useRef<{ sectionId: string; index: number } | null>(null);
  const dragBlockOverItem = useRef<{ sectionId: string; index: number } | null>(null);

  useEffect(() => { 
    fetchConfig(); 
  }, []);

  const fetchConfig = async () => {
    try {
      const [schemaRes, historyRes, filtersRes, catsRes] = await Promise.all([
        supabase.from('site_settings').select('data').eq('id', 'registration_schema').maybeSingle(),
        supabase.from('site_settings').select('data').eq('id', 'registration_schema_history').maybeSingle(),
        supabase.from('filter_options').select('type, name'),
        supabase.from('custom_categories').select('name')
      ]);

      if (schemaRes.data?.data?.sections?.length > 0) {
        setSchema(schemaRes.data.data);
      } else {
        setSchema(BASELINE_SCHEMA); 
      }

      if (historyRes.data?.data?.versions) {
        setHistory(historyRes.data.data.versions);
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
    
    // Only allow reordering within the same section to keep data models safe
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
    options: ['Option 1', 'Option 2'], content: '<p>Edit your text here.</p>', isPublicCustomField: true
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

    // Delegate to specific picker if it's an image upload
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
        {/* Block Drag Handle Indicator */}
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
                  setLocal({...local, dbColumn: formattedName});
                  updateBlock(sectionId, block.id, { dbColumn: formattedName });
                }
              } else {
                setLocal({...local, dbColumn: val});
                updateBlock(sectionId, block.id, { dbColumn: val });
              }
            }}
            className="w-full p-3 bg-white border border-blue-200 text-gray-900 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <optgroup label="Standard Columns">
              {BASE_COLUMNS.map(col => {
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
      
      {/* WRAPPER */}
      <div className={`w-full transition-all duration-300 ${isSidebarOpen ? 'mr-[400px]' : ''} flex flex-col items-center p-6`}>
        
        {/* TOOLBAR */}
        <div className="flex justify-between items-center mb-8 sticky top-4 z-40 bg-white/90 backdrop-blur-md p-4 rounded-[24px] shadow-sm border border-gray-200 w-full max-w-5xl">
          <div><h2 className="text-xl font-black text-gray-900 tracking-tight">Form Builder</h2></div>
          <div className="flex items-center gap-4">
            
            <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
               <button onClick={() => setViewport('mobile')} className={`px-3 py-1.5 text-xs font-black rounded-md transition ${viewport === 'mobile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>Mobile</button>
               <button onClick={() => setViewport('tablet')} className={`px-3 py-1.5 text-xs font-black rounded-md transition ${viewport === 'tablet' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>Tablet</button>
               <button onClick={() => setViewport('desktop')} className={`px-3 py-1.5 text-xs font-black rounded-md transition ${viewport === 'desktop' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>Desktop</button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>
            <button onClick={() => setShowHistoryModal(true)} className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-full font-bold text-sm hover:bg-amber-100 transition">History</button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`px-4 py-2 rounded-full font-bold text-sm transition ${isSidebarOpen ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Properties</button>
            <button onClick={saveConfig} disabled={saving} className="bg-orange-600 text-white px-6 py-2 rounded-full font-black text-sm hover:bg-orange-700 shadow-md transition disabled:opacity-50">{saving ? 'Saving...' : 'Publish'}</button>
          </div>
        </div>

        {/* CANVAS */}
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

      {/* PROPERTIES SIDEBAR */}
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

      {/* SAFE DELETE MODAL */}
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

      {/* VERSION HISTORY MODAL */}
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
    </div>
  );
}