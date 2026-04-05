'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BlockType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'html' | 'hours_source' | 'operating_hours' | 'photo_method';

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
  conditions?: FormCondition[]; // NEW: Supports nested sub-elements
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

// ----------------------------------------------------------------------
// THE BASELINE SCHEMA (Now utilizes nested conditions for hours)
// ----------------------------------------------------------------------
const BASELINE_SCHEMA: FormSchema = {
  pageTitle: "ワセメシ情報ご提供のお願い",
  pageDescription: "私たちは早稲田大学国際教養学部の「イートチーム」と申します。\n「ワセメシ」の魅力をもっと多くの方に知っていただき、地域のお店と学生・観光客をつなぐ多言語対応のレストラン検索サイト「イートダキマス」を作成しています。\n\n✅ 掲載はすべて無料です\n✅ 頂いた情報を元に、こちらで多言語（英語等）に翻訳して掲載します\n✅ 所要時間は5〜10分程度です",
  sections: [
    {
      id: "sec_1",
      title: "1. 店舗の基本情報",
      description: "",
      blocks: [
        { id: "b_title", type: "text", label: "店舗名 (🌐 サイト公開)", dbColumn: "title", required: true, placeholder: "例：いねや本館" },
        { id: "b_cname", type: "text", label: "ご担当者名 (🔒 非公開)", dbColumn: "contact_name", required: false, placeholder: "例：早稲田 太郎" },
        { id: "b_cphone", type: "text", label: "電話番号 (🔒 非公開)", dbColumn: "contact_phone", required: false, placeholder: "例：03-1234-5678", validation: "phone" },
        { id: "b_cemail", type: "text", label: "メールアドレス (🔒 非公開)", dbColumn: "contact_email", required: false, placeholder: "例：shop@example.com", validation: "email" },
        { id: "b_address", type: "text", label: "住所 (🌐 サイト公開)", dbColumn: "address", required: false, placeholder: "例：東京都新宿区西早稲田1-2-3" }
      ]
    },
    {
      id: "sec_2",
      title: "2. 営業時間",
      description: "※ 定休日の場合は未記入、営業日は「11:00〜14:00、17:00〜21:00」のようにご記入ください。",
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
                { id: "b_hmanual", type: "operating_hours", label: "手動入力", dbColumn: "operating_hours", required: false }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "sec_3",
      title: "3. お食事とサービス",
      description: "",
      blocks: [
        { id: "b_cuisine", type: "checkbox", label: "代表的な料理ジャンル (複数可)", dbColumn: "cuisine", required: false, options: ['和食', '洋食', '中華', '韓国料理', 'インド料理', '東南アジア', 'ファストフード', 'カフェ・スイーツ', '寿司', '丼もの'] },
        { id: "b_restrict", type: "checkbox", label: "食事制限への対応 (複数可)", dbColumn: "food_restrictions", required: false, options: ['ハラール', 'ヴィーガン', 'ベジタリアン', 'グルテンフリー', 'コーシャ', '乳製品不使用', 'ペスカタリアン'] },
        { id: "b_price", type: "select", label: "1名あたりの平均ご利用金額（目安）", dbColumn: "restaurant_price", required: false, options: ["500", "1000", "1500", "2000", "3000", "5000"] },
        { id: "b_desc", type: "textarea", label: "店舗紹介・おすすめメニュー", dbColumn: "description", required: false, placeholder: "お店の雰囲気や、学生に人気なメニューなど自由にご記入ください。" }
      ]
    },
    {
      id: "sec_4",
      title: "4. 設備・テイクアウト",
      description: "",
      blocks: [
        { id: "b_seats", type: "text", label: "総席数", dbColumn: "total_seats", required: false, placeholder: "例：30席" },
        { id: "b_stay", type: "select", label: "平均滞接時間", dbColumn: "avg_stay_time", required: false, options: ["〜15分", "15分〜30分", "30分〜1時間", "1時間以上"] },
        { id: "b_takeout", type: "radio", label: "テイクアウト（お持ち帰り）を行っている", dbColumn: "custom_fields.takeout_available_text", required: false, options: ["はい", "いいえ"] },
        { id: "b_tmenu", type: "text", label: "テイクアウト可能なメニュー", dbColumn: "takeout_menu", required: false, placeholder: "例：お弁当各種、カレー" },
        { id: "b_tmethod", type: "checkbox", label: "注文方法 (複数可)", dbColumn: "payment_methods", required: false, options: ['店頭注文', '電話注文', 'オンライン(Uber等)'] },
        { id: "b_atom", type: "radio", label: "地域通貨「アトム通貨」は使えますか？", dbColumn: "custom_fields.atom_currency_text", required: false, options: ["はい", "いいえ"] }
      ]
    },
    {
      id: "sec_5",
      title: "5. 写真のご提供方法",
      description: "",
      blocks: [
        { id: "b_pmethod", type: "photo_method", label: "店舗やメニューの写真のご提供方法をお選びください", dbColumn: "photo_method", required: true, options: ["後でメールで送る", "店舗HPの写真を使用する", "スタッフに撮影を依頼する"] },
        { id: "b_notes", type: "textarea", label: "その他ご質問・ご要望", dbColumn: "admin_notes", required: false, placeholder: "ご不明点があればご自由にご記入ください。" }
      ]
    }
  ]
};
// ----------------------------------------------------------------------

export default function RegistrationEditor() {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [history, setHistory] = useState<VersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [editingBlock, setEditingBlock] = useState<{ sectionId: string; blockId: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [zoom, setZoom] = useState(1); 

  // SAFE DELETE STATE
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'section' | 'block';
    sectionId: string;
    blockId?: string;
  } | null>(null);

  const dragSectionItem = useRef<number | null>(null);
  const dragSectionOverItem = useRef<number | null>(null);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    const [schemaRes, historyRes] = await Promise.all([
      supabase.from('site_settings').select('data').eq('id', 'registration_schema').maybeSingle(),
      supabase.from('site_settings').select('data').eq('id', 'registration_schema_history').maybeSingle()
    ]);

    if (schemaRes.data && schemaRes.data.data.sections && schemaRes.data.data.sections.length > 0) {
      setSchema(schemaRes.data.data);
    } else {
      setSchema(BASELINE_SCHEMA); 
    }

    if (historyRes.data && historyRes.data.data.versions) {
      setHistory(historyRes.data.data.versions);
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    const newVersion: VersionHistory = { timestamp: new Date().toISOString(), schema: schema! };
    const updatedHistory = [newVersion, ...history].slice(0, 15);
    
    await Promise.all([
      supabase.from('site_settings').upsert({ id: 'registration_schema', data: schema }),
      supabase.from('site_settings').upsert({ id: 'registration_schema_history', data: { versions: updatedHistory } })
    ]);

    setHistory(updatedHistory);
    setSaving(false);
    alert('Form Schema Saved Successfully!');
  };

  const restoreVersion = (archivedSchema: FormSchema) => {
    if (confirm("Restore this version? Make sure to click Publish to save it.")) {
      setSchema(archivedSchema);
      setShowHistoryModal(false);
      setEditingBlock(null);
      setIsSidebarOpen(false);
      setZoom(1);
    }
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- RECURSIVE MUTATION ENGINE ---
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

  // --- SAFE DELETE LOGIC ---
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

  const handleSort = () => {
    if (!schema || dragSectionItem.current === null || dragSectionOverItem.current === null) return;
    const sections = [...schema.sections];
    const draggedItemContent = sections.splice(dragSectionItem.current, 1)[0];
    sections.splice(dragSectionOverItem.current, 0, draggedItemContent);
    dragSectionItem.current = null;
    dragSectionOverItem.current = null;
    setSchema({ ...schema, sections });
  };

  // --- BLOCK MANAGEMENT ---
  const createNewBlock = (type: BlockType): FormBlock => ({
    id: generateId(), type, label: `New ${type}`, required: false, dbColumn: `custom_fields.${generateId()}`,
    options: ['Option 1', 'Option 2'], content: '<p>Edit your text here.</p>'
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

  // --- RECURSIVE CANVAS RENDERER ---
  const renderCanvasBlock = (block: FormBlock, sectionId: string) => {
    const isEditing = editingBlock?.blockId === block.id;
    
    return (
      <div key={block.id} className="mb-3">
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

              {block.type === 'photo_method' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {block.options?.map(opt => <div key={opt} className="p-3 rounded-xl border-2 border-gray-200 font-bold text-gray-600 text-sm">{opt}</div>)}
                 </div>
              )}

              {block.type === 'text' && <div className="h-10 bg-gray-50 border border-gray-100 rounded-lg w-full"></div>}
              {block.type === 'textarea' && <div className="h-20 bg-gray-50 border border-gray-100 rounded-lg w-full"></div>}
              {block.type === 'select' && <div className="h-10 bg-gray-50 border border-gray-100 rounded-lg w-full flex items-center px-3 text-gray-400 text-sm">Dropdown...</div>}
              {(block.type === 'checkbox' || block.type === 'radio') && (
                 <div className="flex flex-wrap gap-2 mt-2">
                   {block.options?.map((opt, i) => <div key={i} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg font-bold shadow-sm">{opt}</div>)}
                 </div>
              )}
              {block.type === 'html' && <div className="prose prose-sm text-gray-500 bg-amber-50 p-3 rounded-lg border border-amber-100" dangerouslySetInnerHTML={{ __html: block.content || '' }} />}
            </div>
            <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-2 py-1 rounded uppercase ml-4 flex-shrink-0">{block.type}</span>
          </div>
        </div>

        {/* Recursive rendering of conditional children */}
        {block.conditions?.map(cond => (
          <div key={cond.triggerValue} className="mt-3 ml-6 pl-4 border-l-4 border-purple-300 relative bg-purple-50/30 rounded-r-2xl py-2">
             <span className="absolute -left-3 top-4 bg-purple-600 text-white shadow-sm text-[10px] font-black px-2 py-0.5 rounded-full">IF: {cond.triggerValue}</span>
             {cond.blocks.map(child => renderCanvasBlock(child, sectionId))}
          </div>
        ))}
      </div>
    );
  };

  // --- RECURSIVE SIDEBAR FINDER ---
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

  if (loading || !schema) return <div className="p-10 font-bold text-gray-500 animate-pulse">Loading Builder Engine...</div>;

  return (
    <div className="flex justify-center mx-auto items-start min-h-screen relative bg-gray-100">
      
      {/* WRAPPER */}
      <div className={`w-full max-w-4xl transition-all duration-300 ${isSidebarOpen ? 'mr-[400px]' : ''} flex flex-col p-6`}>
        
        {/* TOOLBAR */}
        <div className="flex justify-between items-center mb-6 sticky top-4 z-40 bg-white/90 backdrop-blur-md p-4 rounded-[24px] shadow-sm border border-gray-200 w-full">
          <div><h2 className="text-xl font-black text-gray-900 tracking-tight">Form Builder</h2></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-full p-1 border border-gray-200">
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.4))} className="w-8 h-8 rounded-full flex items-center justify-center font-black text-gray-500 hover:bg-white hover:shadow-sm transition">-</button>
              <span className="w-14 text-center text-xs font-black text-gray-700 cursor-pointer" onClick={() => setZoom(1)} title="Reset Zoom">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} className="w-8 h-8 rounded-full flex items-center justify-center font-black text-gray-500 hover:bg-white hover:shadow-sm transition">+</button>
            </div>
            <div className="h-6 w-px bg-gray-300"></div>
            <button onClick={() => setShowHistoryModal(true)} className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-full font-bold text-sm hover:bg-amber-100 transition">🕒 History</button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`px-4 py-2 rounded-full font-bold text-sm transition ${isSidebarOpen ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>⚙️ Props</button>
            <button onClick={saveConfig} disabled={saving} className="bg-orange-600 text-white px-6 py-2 rounded-full font-black text-sm hover:bg-orange-700 shadow-md transition disabled:opacity-50">{saving ? 'Saving...' : 'Publish'}</button>
          </div>
        </div>

        {/* CANVAS */}
        <div className="w-full space-y-6 pb-40 transition-transform duration-200" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <div className="bg-white p-8 rounded-[32px] border border-gray-200 shadow-sm relative z-10">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Global Form Header</label>
            <input type="text" value={schema.pageTitle} onChange={e => setSchema({...schema, pageTitle: e.target.value})} className="w-full text-3xl font-black mb-4 outline-none placeholder-gray-300" placeholder="Page Title" />
            <textarea rows={6} value={schema.pageDescription} onChange={e => setSchema({...schema, pageDescription: e.target.value})} className="w-full text-gray-600 font-medium outline-none resize-none placeholder-gray-300" placeholder="Page Description (supports newlines)" />
          </div>

          {schema.sections.map((section, index) => (
            <div key={section.id} draggable onDragStart={() => (dragSectionItem.current = index)} onDragEnter={() => (dragSectionOverItem.current = index)} onDragEnd={handleSort} className="bg-white p-6 rounded-[32px] border-2 border-transparent hover:border-orange-200 shadow-sm transition relative group cursor-move z-10">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">⋮⋮ Drag to reorder</span>
                <button onClick={() => setPendingDelete({ type: 'section', sectionId: section.id })} className="bg-red-100 text-red-600 w-8 h-8 rounded-full font-bold flex items-center justify-center hover:bg-red-200">✕</button>
              </div>

              <input type="text" value={section.title} onChange={e => updateSection(section.id, 'title', e.target.value)} className="w-full text-2xl font-black bg-transparent outline-none mb-2 text-gray-900" placeholder="Section Title" />
              <input type="text" value={section.description} onChange={e => updateSection(section.id, 'description', e.target.value)} className="w-full text-sm font-bold bg-transparent outline-none mb-6 text-gray-500" placeholder="Section Description (Optional)" />

              <div className="cursor-default" onDragStart={e => e.stopPropagation()} draggable={false}>
                {section.blocks.map(block => renderCanvasBlock(block, section.id))}
              </div>

              {/* ADVANCED ADD TOOLS */}
              <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-4 cursor-default">
                <span className="text-xs font-bold text-gray-400 py-1 mr-2">Add Element:</span>
                <button onClick={() => addBlockToSection(section.id, 'text')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Text</button>
                <button onClick={() => addBlockToSection(section.id, 'textarea')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Textarea</button>
                <button onClick={() => addBlockToSection(section.id, 'checkbox')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Checkboxes</button>
                <button onClick={() => addBlockToSection(section.id, 'radio')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Radio</button>
                <button onClick={() => addBlockToSection(section.id, 'select')} className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition">+ Dropdown</button>
                <button onClick={() => addBlockToSection(section.id, 'html')} className="text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition">+ HTML Block</button>
                
                <span className="text-xs font-bold text-gray-400 py-1 ml-4 mr-2 border-l pl-4">Custom UI:</span>
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
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b pb-4">
                 <span className="bg-orange-100 text-orange-800 text-xs font-black px-2 py-1 rounded uppercase">{activeEditingBlockProps.type}</span>
                 <button onClick={() => setPendingDelete({ type: 'block', sectionId: editingBlock.sectionId, blockId: activeEditingBlockProps!.id })} className="text-red-500 text-sm font-bold hover:underline">Delete Block</button>
              </div>

              {activeEditingBlockProps.type !== 'html' && (
                <>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Display Label</label>
                    <input type="text" value={activeEditingBlockProps.label} onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { label: e.target.value })} className="w-full p-3 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Placeholder</label>
                    <input type="text" value={activeEditingBlockProps.placeholder || ''} onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { placeholder: e.target.value })} className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  
                  {activeEditingBlockProps.type === 'text' && (
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Validation Rule</label>
                      <select 
                        value={activeEditingBlockProps.validation || 'none'} 
                        onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { validation: e.target.value as any })}
                        className="w-full p-3 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="none">None (Standard Text)</option>
                        <option value="email">Email Address</option>
                        <option value="url">Website URL</option>
                        <option value="number">Number Only</option>
                        <option value="phone">Phone Number</option>
                      </select>
                    </div>
                  )}

                  <label className="flex items-center cursor-pointer p-3 bg-gray-50 border rounded-xl hover:bg-gray-100 transition">
                    <input type="checkbox" checked={activeEditingBlockProps.required} onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { required: e.target.checked })} className="w-5 h-5 accent-orange-500 mr-3" />
                    <span className="font-bold text-gray-700">Required Field</span>
                  </label>
                </>
              )}

              {activeEditingBlockProps.type === 'html' && (
                <div>
                   <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Raw HTML / Markdown</label>
                   <textarea rows={10} value={activeEditingBlockProps.content || ''} onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { content: e.target.value })} className="w-full p-4 bg-gray-900 text-green-400 font-mono text-sm rounded-xl outline-none" placeholder="<p>Enter text...</p>" />
                </div>
              )}

              {['select', 'checkbox', 'radio', 'hours_source', 'photo_method'].includes(activeEditingBlockProps.type) && (
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Options (One per line)</label>
                  <textarea rows={6} value={(activeEditingBlockProps.options || []).join('\n')} onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { options: e.target.value.split('\n') })} className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500 whitespace-pre" />
                </div>
              )}

              {/* DYNAMIC SUB-ELEMENT BUILDER */}
              {['select', 'checkbox', 'radio', 'hours_source', 'photo_method'].includes(activeEditingBlockProps.type) && (
                <div className="pt-6 border-t border-gray-200">
                   <h4 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-4">Conditional Logic</h4>
                   <p className="text-xs text-gray-500 mb-4 font-medium">Attach follow-up questions when a user selects specific options below.</p>
                   {activeEditingBlockProps.options?.map(opt => {
                      const condition = activeEditingBlockProps!.conditions?.find(c => c.triggerValue === opt);
                      return (
                        <div key={opt} className="mb-4 bg-purple-50 p-4 rounded-xl border border-purple-100">
                          <span className="font-bold text-sm text-purple-900 block mb-2">If user selects: "{opt}"</span>
                          <div className="space-y-2">
                            {condition?.blocks.map(child => (
                               <div key={child.id} className="flex justify-between items-center bg-white border border-purple-200 p-2 rounded-lg text-xs font-bold text-gray-700 shadow-sm">
                                 <span>↳ {child.label} <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded ml-1">{child.type}</span></span>
                                 <button onClick={() => setEditingBlock({sectionId: editingBlock.sectionId, blockId: child.id})} className="text-purple-600 hover:underline">Edit</button>
                               </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button onClick={() => addBlockToCondition(editingBlock.sectionId, activeEditingBlockProps!.id, opt, 'operating_hours')} className="text-[10px] font-black uppercase tracking-wider bg-white border border-purple-200 text-purple-700 px-2 py-1.5 rounded hover:bg-purple-100">+ Add 7-Day Grid</button>
                            <button onClick={() => addBlockToCondition(editingBlock.sectionId, activeEditingBlockProps!.id, opt, 'text')} className="text-[10px] font-black uppercase tracking-wider bg-white border border-purple-200 text-purple-700 px-2 py-1.5 rounded hover:bg-purple-100">+ Add Text Input</button>
                          </div>
                        </div>
                      )
                   })}
                </div>
              )}

              <div className="pt-6 border-t border-gray-200">
                <label className="block text-xs font-black text-blue-500 uppercase tracking-widest mb-2">Database Mapping (Data Key)</label>
                <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded mb-2 border border-red-100">
                  ⚠️ WARNING: Changing an established key will orphan past data.
                </p>
                <input type="text" value={activeEditingBlockProps.dbColumn} onChange={e => updateBlock(editingBlock.sectionId, activeEditingBlockProps!.id, { dbColumn: e.target.value })} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., title, custom_fields.wifi" />
              </div>
            </div>
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