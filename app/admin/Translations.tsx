'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from './shared';

export default function Translations({
  appLanguages,
  setAppLanguages,
  uiTranslations,
  setUiTranslations,
  masterFilters,
  setMasterFilters,
  liveRestaurants,
  pendingSubmissions, 
  fetchAllData,
  updateBaseTagName,
  formSchema // NEW: Passed in from page.tsx to extract custom text fields
}: any) {
  const [transSubTab, setTransSubTab] = useState<'global' | 'tags' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  
  // State now accepts custom_fields object
  const [transDraft, setTransDraft] = useState({ 
    title: '', 
    description: '', 
    full_menu: '', 
    takeout_menu: '', 
    discount_info: '',
    website_url: '',
    total_seats: '',
    avg_stay_time: '',
    photo_method: '',
    admin_notes: '',
    category_collabs: {} as any,
    custom_fields: {} as Record<string, string> 
  });
  
  const [savingTrans, setSavingTrans] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const translationLangs = appLanguages.filter((lang: any) => lang.code !== 'ja');
  const allRestaurantsList = [...liveRestaurants, ...pendingSubmissions];

  // Helper to extract translation text blocks dynamically from schema
  const customTextFields = (formSchema || []).filter((b: any) => 
    b.dbColumn?.startsWith('custom_fields.') && 
    (b.type === 'text' || b.type === 'textarea')
  );

  const addLanguage = async () => {
    if (!newLangCode || !newLangName) return;
    const { error } = await supabase.from('app_languages').insert({ code: newLangCode, name: newLangName });
    if (!error) {
      setNewLangCode(''); setNewLangName('');
      fetchAllData();
    } else alert(error.message);
  };

  const deleteLanguage = async (code: string) => {
    if (code === 'ja') return alert("Cannot delete primary language.");
    if (confirm(`Delete language ${code}?`)) {
      await supabase.from('app_languages').delete().eq('code', code);
      fetchAllData();
    }
  };

  const addGlobalTranslation = async () => {
    if (!newTransKey) return;
    const { error } = await supabase.from('ui_translations').insert({ translation_key: newTransKey, values: {} });
    if (!error) {
      setNewTransKey('');
      fetchAllData();
    } else alert(error.message);
  };

  const updateGlobalTranslation = async (key: string, langCode: string, value: string) => {
    const existing = uiTranslations.find((u: any) => u.translation_key === key);
    const newValues = { ...(existing?.values || {}), [langCode]: value };
    await supabase.from('ui_translations').update({ values: newValues }).eq('translation_key', key);
    fetchAllData();
  };

  const deleteGlobalTranslation = async (key: string) => {
    if (confirm(`Delete UI string "${key}"?`)) {
      await supabase.from('ui_translations').delete().eq('translation_key', key);
      fetchAllData();
    }
  };

  const updateTagTranslation = async (filterId: string, langCode: string, value: string) => {
    const filter = masterFilters.find((f: any) => f.id === filterId);
    if (!filter) return;
    const newTranslations = { ...(filter.translations || {}), [langCode]: value };
    await supabase.from('filter_options').update({ translations: newTranslations }).eq('id', filterId);
    fetchAllData();
  };

  const selectRestaurantForTranslation = (id: string, lang: string) => {
    setSelectedTransRestId(id);
    setSelectedTransLang(lang);
    
    const rest = allRestaurantsList.find(r => r.id === id);
    const existingTrans = rest?.translations?.[lang] || {};
    
    // Safely load custom_fields translations or empty object
    setTransDraft({
      title: existingTrans.title || '',
      description: existingTrans.description || '',
      full_menu: existingTrans.full_menu || '',
      takeout_menu: existingTrans.takeout_menu || '',
      discount_info: existingTrans.discount_info || '',
      website_url: existingTrans.website_url || '',
      total_seats: existingTrans.total_seats || '',
      avg_stay_time: existingTrans.avg_stay_time || '',
      photo_method: existingTrans.photo_method || '',
      admin_notes: existingTrans.admin_notes || '',
      category_collabs: existingTrans.category_collabs || {},
      custom_fields: existingTrans.custom_fields || {}
    });
  };

  const saveRestaurantTranslation = async () => {
    if (!selectedTransRestId || !selectedTransLang) return;
    setSavingTrans(true);
    const rest = allRestaurantsList.find(r => r.id === selectedTransRestId);
    if (!rest) return;

    const updatedTranslations = {
      ...(rest.translations || {}),
      [selectedTransLang]: transDraft
    };

    const { error } = await supabase.from('restaurants').update({ translations: updatedTranslations }).eq('id', selectedTransRestId);
    setSavingTrans(false);
    
    if (error) alert(error.message);
    else {
      alert(`✅ Translations saved for ${selectedTransLang.toUpperCase()}!`);
      fetchAllData();
      setSelectedTransRestId('');
    }
  };

  const selectedTransRestData = allRestaurantsList.find(r => r.id === selectedTransRestId);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-200">
        <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
          <Icons.Translations className="w-6 h-6 text-blue-500" /> Active System Languages
        </h2>
        <div className="flex flex-wrap gap-3 mb-6">
          {appLanguages.map((lang: any) => (
            <div key={lang.code} className={`flex items-center gap-3 px-4 py-2 rounded-xl border-2 font-bold ${lang.code === 'ja' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
              <span className="uppercase tracking-widest">{lang.code}</span>
              <span className="text-sm opacity-80 border-l border-current pl-3">{lang.name}</span>
              {lang.code !== 'ja' && (
                <button onClick={() => deleteLanguage(lang.code)} className="ml-2 text-red-400 hover:text-red-600 transition">✕</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <input type="text" value={newLangCode} onChange={e => setNewLangCode(e.target.value)} placeholder="Code (e.g. en, ko, zh)" className="p-3 border rounded-xl text-sm font-bold flex-1 uppercase outline-none" />
          <input type="text" value={newLangName} onChange={e => setNewLangName(e.target.value)} placeholder="Name (e.g. English)" className="p-3 border rounded-xl text-sm font-bold flex-1 outline-none" />
          <button onClick={addLanguage} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-md whitespace-nowrap">Add Language</button>
        </div>
      </div>

      {translationLangs.length === 0 ? (
        <div className="bg-blue-50 text-blue-800 p-8 rounded-[32px] font-bold text-center border border-blue-100">
          Add a secondary language above to start translating content.
        </div>
      ) : (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
          <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 shrink-0 custom-scrollbar">
            <button onClick={() => setTransSubTab('global')} className={`px-8 py-5 text-sm font-black transition whitespace-nowrap ${transSubTab === 'global' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>UI Interface Strings</button>
            <button onClick={() => setTransSubTab('tags')} className={`px-8 py-5 text-sm font-black transition whitespace-nowrap ${transSubTab === 'tags' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>Master Filter Tags</button>
            <button onClick={() => setTransSubTab('restaurants')} className={`px-8 py-5 text-sm font-black transition whitespace-nowrap ${transSubTab === 'restaurants' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>Restaurant Content</button>
          </div>

          {transSubTab === 'global' && (
            <div className="p-8 flex-1 overflow-y-auto">
               <div className="flex gap-3 mb-8 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                 <input type="text" value={newTransKey} onChange={e => setNewTransKey(e.target.value)} placeholder="New Key (e.g. btn_submit)" className="p-3 border rounded-xl text-sm font-bold flex-1 outline-none" />
                 <button onClick={addGlobalTranslation} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl hover:bg-blue-700 transition">Add Key</button>
               </div>
               <div className="space-y-4">
                 {uiTranslations.map((item: any) => (
                   <div key={item.translation_key} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-200 transition shadow-sm">
                     <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-md">{item.translation_key}</span>
                        <button onClick={() => deleteGlobalTranslation(item.translation_key)} className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition">Delete</button>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">JA (Base)</label>
                           <input type="text" value={item.values?.ja || ''} onChange={(e) => updateGlobalTranslation(item.translation_key, 'ja', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
                        </div>
                        {translationLangs.map((lang: any) => (
                          <div key={lang.code} className="space-y-1">
                             <label className="text-[10px] font-black text-blue-400 uppercase ml-1 tracking-widest">{lang.code}</label>
                             <input type="text" value={item.values?.[lang.code] || ''} onChange={(e) => updateGlobalTranslation(item.translation_key, lang.code, e.target.value)} placeholder="Missing translation..." className="w-full p-3 bg-white border border-blue-100 rounded-xl text-sm font-bold text-blue-900 outline-none focus:border-blue-500 shadow-inner" />
                          </div>
                        ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {transSubTab === 'tags' && (
            <div className="p-8 flex-1 overflow-y-auto space-y-8">
              {Array.from(new Set(masterFilters.map((f: any) => f.type))).map(type => (
                <div key={type as string}>
                   <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{type} Tags</h3>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                     {masterFilters.filter((f: any) => f.type === type).map((filter: any) => (
                       <div key={filter.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-blue-200 transition">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black bg-gray-900 text-white px-2 py-1 rounded">JA</span>
                            <span className="font-black text-gray-900">{filter.name}</span>
                         </div>
                         <div className="flex flex-col gap-2 pl-4 border-l-2 border-blue-50">
                           {translationLangs.map((lang: any) => (
                             <div key={lang.code} className="flex items-center gap-3">
                               <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded w-8 text-center">{lang.code.toUpperCase()}</span>
                               <input type="text" value={filter.translations?.[lang.code] || ''} onChange={(e) => updateTagTranslation(filter.id, lang.code, e.target.value)} placeholder="Missing translation..." className="flex-1 p-2 bg-white border border-blue-100 rounded-lg text-sm font-bold outline-none focus:border-blue-400" />
                             </div>
                           ))}
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              ))}
            </div>
          )}

          {transSubTab === 'restaurants' && !selectedTransRestId && (
            <div className="p-8 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allRestaurantsList.map(rest => {
                  const completeness = translationLangs.map((l: any) => {
                    const hasData = rest.translations?.[l.code]?.title || rest.translations?.[l.code]?.description;
                    return { code: l.code, hasData: !!hasData };
                  });

                  return (
                    <div key={rest.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-400 transition shadow-sm group">
                      <h3 className="font-black text-gray-900 mb-4 truncate group-hover:text-blue-600 transition">{rest.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {completeness.map((c: any) => (
                          <button key={c.code} onClick={() => selectRestaurantForTranslation(rest.id, c.code)} className={`px-4 py-2 rounded-xl text-xs font-black transition ${c.hasData ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}>
                            {c.code.toUpperCase()} {c.hasData ? '✓' : 'Translate'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {transSubTab === 'restaurants' && selectedTransRestId && selectedTransRestData && (
            <div className="p-8 flex-1 overflow-y-auto flex flex-col bg-gray-50/50">
               <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                 <div>
                   <button onClick={() => setSelectedTransRestId('')} className="text-xs font-bold text-gray-400 hover:text-gray-900 mb-1 flex items-center gap-1">← Back to List</button>
                   <h2 className="text-2xl font-black text-gray-900">{selectedTransRestData.title}</h2>
                 </div>
                 <div className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-widest shadow-md">
                   {selectedTransLang} Editor
                 </div>
               </div>

               <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                 {/* Left Column: Original Japanese Context */}
                 <div className="space-y-6 opacity-60 pointer-events-none">
                    <h3 className="font-black text-gray-400 border-b border-gray-200 pb-2">Original (JA)</h3>
                    <div className="space-y-4">
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Title</label>
                         <input type="text" readOnly value={selectedTransRestData.title || ''} className="w-full p-4 border rounded-xl text-sm font-bold bg-white text-gray-500" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Description</label>
                         <textarea rows={4} readOnly value={selectedTransRestData.description || ''} className="w-full p-4 border rounded-xl text-sm font-bold bg-white text-gray-500" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Full Menu</label>
                         <textarea rows={6} readOnly value={selectedTransRestData.full_menu || ''} className="w-full p-4 border rounded-xl text-sm font-bold bg-white text-gray-500" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Takeout Menu</label>
                         <textarea rows={3} readOnly value={selectedTransRestData.takeout_menu || ''} className="w-full p-4 border rounded-xl text-sm font-bold bg-white text-gray-500" />
                       </div>

                       {/* Read-Only Custom Field Values */}
                       {customTextFields.map((block: any) => {
                          const jsonKey = block.dbColumn.replace('custom_fields.', '');
                          const originalVal = selectedTransRestData.custom_fields?.[jsonKey] || '';
                          return (
                            <div key={block.id}>
                              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">{block.label}</label>
                              <textarea rows={2} readOnly value={originalVal} className="w-full p-4 border rounded-xl text-sm font-bold bg-white text-gray-500" />
                            </div>
                          );
                       })}

                       {selectedTransRestData.other_options && selectedTransRestData.other_options.length > 0 && (
                          <div className="pt-4 border-t border-gray-200 space-y-3">
                             <h4 className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Event Content</h4>
                             {selectedTransRestData.other_options.map((opt: string) => (
                                <div key={opt} className="bg-white p-4 rounded-xl border">
                                   <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block mb-1">{opt}</label>
                                   <textarea rows={2} readOnly value={selectedTransRestData.category_collabs?.[opt] || ''} className="w-full p-2 border-0 bg-transparent text-xs font-bold text-gray-500" />
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>

                 {/* Right Column: Editable Translation Draft */}
                 <div className="space-y-6">
                    <h3 className="font-black text-blue-600 border-b border-blue-200 pb-2">Translated ({selectedTransLang.toUpperCase()})</h3>
                    <div className="space-y-4">
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Title Translation</label>
                         <input type="text" value={transDraft.title} onChange={(e) => setTransDraft({...transDraft, title: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-bold bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated title..." />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Description Translation</label>
                         <textarea rows={4} value={transDraft.description} onChange={(e) => setTransDraft({...transDraft, description: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-bold bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated description..." />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Menu Translation</label>
                         <textarea rows={6} value={transDraft.full_menu} onChange={(e) => setTransDraft({...transDraft, full_menu: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-bold bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated menu..." />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Takeout Translation</label>
                         <textarea rows={3} value={transDraft.takeout_menu} onChange={(e) => setTransDraft({...transDraft, takeout_menu: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-bold bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated takeout menu..." />
                       </div>

                       {/* EDITABLE DYNAMIC CUSTOM FIELD TRANSLATIONS */}
                       {customTextFields.map((block: any) => {
                          const jsonKey = block.dbColumn.replace('custom_fields.', '');
                          return (
                            <div key={block.id}>
                              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">{block.label} Translation</label>
                              <textarea 
                                rows={2} 
                                value={transDraft.custom_fields?.[jsonKey] || ''} 
                                onChange={(e) => setTransDraft({
                                  ...transDraft, 
                                  custom_fields: { ...transDraft.custom_fields, [jsonKey]: e.target.value }
                                })} 
                                className="w-full p-4 border border-blue-100 rounded-xl text-sm font-bold bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                placeholder={`Translated ${block.label}...`} 
                              />
                            </div>
                          );
                       })}

                       {selectedTransRestData.other_options && selectedTransRestData.other_options.length > 0 && (
                          <div className="pt-4 border-t border-blue-200 space-y-3 bg-blue-50/30 p-4 rounded-3xl mt-4">
                             <h4 className="text-[9px] font-black text-blue-400 uppercase ml-2 tracking-widest">Translate Event Content</h4>
                             {selectedTransRestData.other_options.map((opt: string) => (
                                <div key={opt} className="bg-white/50 p-4 rounded-2xl border border-blue-100 shadow-inner">
                                   <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block mb-2">{opt}</label>
                                   <textarea rows={2} value={transDraft.category_collabs?.[opt] || ''} onChange={(e) => setTransDraft({...transDraft, category_collabs: { ...transDraft.category_collabs, [opt]: e.target.value }})} className="w-full p-3 border border-blue-50 rounded-xl text-[11px] font-bold text-blue-900 bg-white" placeholder={`Local info for ${opt}...`} />
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>
               </div>

               <button onClick={saveRestaurantTranslation} disabled={savingTrans} className="w-full bg-blue-600 text-white font-black py-6 rounded-[32px] shadow-xl hover:bg-blue-700 hover:scale-[1.01] transition disabled:opacity-50 text-xl tracking-tighter uppercase">
                 {savingTrans ? 'Pushing Data...' : `Commit ${selectedTransLang.toUpperCase()} Translation`}
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}