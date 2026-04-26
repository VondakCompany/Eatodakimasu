// /app/admin/Translations.tsx
'use client';
import { useState, useMemo } from 'react';
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
  formSchema 
}: any) {
  const [transSubTab, setTransSubTab] = useState<'global' | 'tags' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  
  // UX Features: Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'missing' | 'complete'>('all');

  const [transDraft, setTransDraft] = useState({ 
    title: '', description: '', full_menu: '', takeout_menu: '', discount_info: '',
    website_url: '', total_seats: '', avg_stay_time: '', photo_method: '', admin_notes: '',
    category_collabs: {} as any, custom_fields: {} as Record<string, string> 
  });
  
  const [savingTrans, setSavingTrans] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');

  const translationLangs = appLanguages.filter((lang: any) => lang.code !== 'ja');
  const allRestaurantsList = [...liveRestaurants, ...pendingSubmissions];

  const customTextFields = (formSchema || []).filter((b: any) => 
    b.dbColumn?.startsWith('custom_fields.') && (b.type === 'text' || b.type === 'textarea')
  );

  // --- CRUD Operations ---
  const addLanguage = async () => {
    if (!newLangCode || !newLangName) return;
    const { error } = await supabase.from('app_languages').insert({ code: newLangCode, name: newLangName });
    if (!error) { setNewLangCode(''); setNewLangName(''); fetchAllData(); } else alert(error.message);
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
    if (!error) { setNewTransKey(''); fetchAllData(); } else alert(error.message);
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

  // --- UX Filtering Logic ---
  const filteredGlobals = useMemo(() => {
    return uiTranslations.filter((item: any) => {
      if (searchQuery && !item.translation_key.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      const isMissing = translationLangs.some((l: any) => !item.values?.[l.code]);
      if (filterStatus === 'missing' && !isMissing) return false;
      if (filterStatus === 'complete' && isMissing) return false;
      return true;
    });
  }, [uiTranslations, searchQuery, filterStatus, translationLangs]);

  const filteredRestaurants = useMemo(() => {
    return allRestaurantsList.filter(rest => {
      if (searchQuery && !rest.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      const isMissingAny = translationLangs.some((l: any) => {
        const t = rest.translations?.[l.code] || {};
        return !t.title || !t.description; // Simple check for missing core fields
      });

      if (filterStatus === 'missing' && !isMissingAny) return false;
      if (filterStatus === 'complete' && isMissingAny) return false;
      return true;
    });
  }, [allRestaurantsList, searchQuery, filterStatus, translationLangs]);

  // --- Editor Functions ---
  const selectRestaurantForTranslation = (id: string, lang: string) => {
    setSelectedTransRestId(id);
    setSelectedTransLang(lang);
    
    const rest = allRestaurantsList.find(r => r.id === id);
    const existingTrans = rest?.translations?.[lang] || {};
    
    setTransDraft({
      title: existingTrans.title || '', description: existingTrans.description || '', full_menu: existingTrans.full_menu || '',
      takeout_menu: existingTrans.takeout_menu || '', discount_info: existingTrans.discount_info || '', website_url: existingTrans.website_url || '',
      total_seats: existingTrans.total_seats || '', avg_stay_time: existingTrans.avg_stay_time || '', photo_method: existingTrans.photo_method || '',
      admin_notes: existingTrans.admin_notes || '', category_collabs: existingTrans.category_collabs || {}, custom_fields: existingTrans.custom_fields || {}
    });
  };

  const saveRestaurantTranslation = async () => {
    if (!selectedTransRestId || !selectedTransLang) return;
    setSavingTrans(true);
    const rest = allRestaurantsList.find(r => r.id === selectedTransRestId);
    if (!rest) return;

    const updatedTranslations = { ...(rest.translations || {}), [selectedTransLang]: transDraft };
    const { error } = await supabase.from('restaurants').update({ translations: updatedTranslations }).eq('id', selectedTransRestId);
    setSavingTrans(false);
    
    if (error) alert(error.message);
    else { alert(`✅ Translations saved for ${selectedTransLang.toUpperCase()}!`); fetchAllData(); setSelectedTransRestId(''); }
  };

  const selectedTransRestData = allRestaurantsList.find(r => r.id === selectedTransRestId);

  // UX Helper: Copy original JA value to draft
  const copyToDraft = (key: keyof typeof transDraft | string, originalValue: string, isCustom = false, isEvent = false) => {
    if (isCustom) {
      setTransDraft(prev => ({ ...prev, custom_fields: { ...prev.custom_fields, [key]: originalValue }}));
    } else if (isEvent) {
      setTransDraft(prev => ({ ...prev, category_collabs: { ...prev.category_collabs, [key]: originalValue }}));
    } else {
      setTransDraft(prev => ({ ...prev, [key]: originalValue }));
    }
  };

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
          <input type="text" value={newLangCode} onChange={e => setNewLangCode(e.target.value)} placeholder="Code (e.g. en, ko, zh)" className="p-3 border rounded-xl text-sm font-bold flex-1 uppercase outline-none focus:border-blue-400" />
          <input type="text" value={newLangName} onChange={e => setNewLangName(e.target.value)} placeholder="Name (e.g. English)" className="p-3 border rounded-xl text-sm font-bold flex-1 outline-none focus:border-blue-400" />
          <button onClick={addLanguage} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-md whitespace-nowrap">Add Language</button>
        </div>
      </div>

      {translationLangs.length === 0 ? (
        <div className="bg-blue-50 text-blue-800 p-8 rounded-[32px] font-bold text-center border border-blue-100">
          Add a secondary language above to start translating content.
        </div>
      ) : (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
          <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 shrink-0 custom-scrollbar relative z-10">
            <button onClick={() => {setTransSubTab('global'); setSearchQuery(''); setFilterStatus('all');}} className={`px-8 py-5 text-sm font-black transition whitespace-nowrap ${transSubTab === 'global' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>UI Interface Strings</button>
            <button onClick={() => {setTransSubTab('tags'); setSearchQuery(''); setFilterStatus('all');}} className={`px-8 py-5 text-sm font-black transition whitespace-nowrap ${transSubTab === 'tags' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>Master Filter Tags</button>
            <button onClick={() => {setTransSubTab('restaurants'); setSearchQuery(''); setFilterStatus('all');}} className={`px-8 py-5 text-sm font-black transition whitespace-nowrap ${transSubTab === 'restaurants' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>Restaurant Content</button>
          </div>

          {/* UX Filter & Search Bar (Visible on list views) */}
          {!selectedTransRestId && (
            <div className="bg-white p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
               <div className="relative flex-1 max-w-md w-full">
                 <Icons.Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                 <input 
                   type="text" 
                   value={searchQuery} 
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Search keys or names..." 
                   className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition" 
                 />
               </div>
               <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                 {['all', 'missing', 'complete'].map((f) => (
                   <button 
                     key={f} 
                     onClick={() => setFilterStatus(f as any)}
                     className={`flex-1 sm:px-4 py-2 text-xs font-black rounded-lg capitalize transition ${filterStatus === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                   >
                     {f}
                   </button>
                 ))}
               </div>
            </div>
          )}

          {transSubTab === 'global' && (
            <div className="p-8 flex-1 overflow-y-auto">
               <div className="flex gap-3 mb-8 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                 <input type="text" value={newTransKey} onChange={e => setNewTransKey(e.target.value)} placeholder="New Key (e.g. btn_submit)" className="p-3 border rounded-xl text-sm font-bold flex-1 outline-none focus:border-blue-400" />
                 <button onClick={addGlobalTranslation} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-sm">Add Key</button>
               </div>
               <div className="space-y-4">
                 {filteredGlobals.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 font-bold">No UI strings match your filters.</div>
                 ) : filteredGlobals.map((item: any) => (
                   <div key={item.translation_key} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-200 transition shadow-sm group">
                     <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-md">{item.translation_key}</span>
                        <button onClick={() => deleteGlobalTranslation(item.translation_key)} className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition opacity-0 group-hover:opacity-100">Delete</button>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1 relative">
                           <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">JA (Base)</label>
                           <input type="text" value={item.values?.ja || ''} onChange={(e) => updateGlobalTranslation(item.translation_key, 'ja', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
                        </div>
                        {translationLangs.map((lang: any) => (
                          <div key={lang.code} className="space-y-1">
                             <label className="text-[10px] font-black text-blue-400 uppercase ml-1 tracking-widest flex justify-between">
                               {lang.code}
                               {!item.values?.[lang.code] && <span className="text-red-400">Missing</span>}
                             </label>
                             <input type="text" value={item.values?.[lang.code] || ''} onChange={(e) => updateGlobalTranslation(item.translation_key, lang.code, e.target.value)} placeholder="Missing translation..." className={`w-full p-3 bg-white border rounded-xl text-sm font-bold outline-none focus:ring-2 shadow-inner ${item.values?.[lang.code] ? 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-100' : 'border-red-200 bg-red-50/30 text-blue-900 focus:border-red-400 focus:ring-red-100'}`} />
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
              {Array.from(new Set(masterFilters.map((f: any) => f.type))).map(type => {
                const typeFilters = masterFilters.filter((f: any) => f.type === type && (
                  (!searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
                  (filterStatus === 'all' || 
                  (filterStatus === 'missing' && translationLangs.some((l:any) => !f.translations?.[l.code])) ||
                  (filterStatus === 'complete' && translationLangs.every((l:any) => !!f.translations?.[l.code])))
                ));

                if (typeFilters.length === 0) return null;

                return (
                  <div key={type as string}>
                     <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{type} Tags</h3>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                       {typeFilters.map((filter: any) => (
                         <div key={filter.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-blue-200 transition">
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black bg-gray-900 text-white px-2 py-1 rounded">JA</span>
                              <span className="font-black text-gray-900">{filter.name}</span>
                           </div>
                           <div className="flex flex-col gap-2 pl-4 border-l-2 border-blue-50">
                             {translationLangs.map((lang: any) => (
                               <div key={lang.code} className="flex items-center gap-3">
                                 <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded w-8 text-center">{lang.code.toUpperCase()}</span>
                                 <input type="text" value={filter.translations?.[lang.code] || ''} onChange={(e) => updateTagTranslation(filter.id, lang.code, e.target.value)} placeholder="Missing translation..." className={`flex-1 p-2 bg-white border rounded-lg text-sm font-bold outline-none ${filter.translations?.[lang.code] ? 'border-gray-200 focus:border-blue-400' : 'border-red-200 bg-red-50/50 focus:border-red-400'}`} />
                               </div>
                             ))}
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                );
              })}
            </div>
          )}

          {transSubTab === 'restaurants' && !selectedTransRestId && (
            <div className="p-8 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRestaurants.map(rest => {
                  const completeness = translationLangs.map((l: any) => {
                    const trans = rest.translations?.[l.code] || {};
                    const totalFields = 2 + customTextFields.length + (rest.other_options?.length || 0); // basic proxy (title, desc + dynamic fields)
                    let filledFields = 0;
                    if (trans.title) filledFields++;
                    if (trans.description) filledFields++;
                    
                    customTextFields.forEach((b:any) => {
                      if (trans.custom_fields?.[b.dbColumn.replace('custom_fields.', '')]) filledFields++;
                    });
                    rest.other_options?.forEach((opt:string) => {
                      if (trans.category_collabs?.[opt]) filledFields++;
                    });

                    const percentage = totalFields === 0 ? 100 : Math.round((filledFields / totalFields) * 100);
                    return { code: l.code, percentage, isComplete: percentage === 100 };
                  });

                  return (
                    <div key={rest.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-400 transition shadow-sm group">
                      <h3 className="font-black text-gray-900 mb-4 truncate group-hover:text-blue-600 transition">{rest.title}</h3>
                      <div className="flex flex-col gap-2">
                        {completeness.map((c: any) => (
                          <button key={c.code} onClick={() => selectRestaurantForTranslation(rest.id, c.code)} className={`flex items-center justify-between p-2 rounded-xl text-xs font-black transition border ${c.isComplete ? 'bg-green-50/50 text-green-700 border-green-100 hover:bg-green-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}>
                            <span>{c.code.toUpperCase()}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full ${c.isComplete ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${c.percentage}%` }}></div>
                              </div>
                              <span className="w-8 text-right opacity-80">{c.percentage}%</span>
                            </div>
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
            <div className="flex-1 overflow-y-auto flex flex-col bg-gray-50 relative">
               
               {/* UX: Sticky Action Bar */}
               <div className="sticky top-0 z-20 flex justify-between items-center bg-white/90 backdrop-blur-md px-8 py-4 border-b border-gray-200 shadow-sm">
                 <div>
                   <button onClick={() => setSelectedTransRestId('')} className="text-xs font-bold text-gray-400 hover:text-gray-900 mb-1 flex items-center gap-1">← Back to List</button>
                   <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                     {selectedTransRestData.title}
                     <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-xs tracking-widest uppercase">
                       {selectedTransLang}
                     </span>
                   </h2>
                 </div>
                 <button onClick={saveRestaurantTranslation} disabled={savingTrans} className="bg-blue-600 text-white font-black px-8 py-3 rounded-2xl shadow-md hover:bg-blue-700 hover:scale-[1.02] transition disabled:opacity-50 text-sm tracking-widest uppercase flex items-center gap-2">
                   {savingTrans ? <Icons.Sync className="w-4 h-4 animate-spin" /> : 'Save Translations'}
                 </button>
               </div>

               <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                 {/* Left Column: Original Japanese Context */}
                 <div className="space-y-6">
                    <h3 className="font-black text-gray-400 border-b border-gray-200 pb-2">Original (JA) Content</h3>
                    <div className="space-y-4 opacity-80">
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Title</label>
                         <input type="text" readOnly value={selectedTransRestData.title || ''} className="w-full p-4 border rounded-xl text-sm font-bold bg-white text-gray-600" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Description</label>
                         <textarea rows={4} readOnly value={selectedTransRestData.description || ''} className="w-full p-4 border rounded-xl text-sm font-medium bg-white text-gray-600" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Full Menu</label>
                         <textarea rows={6} readOnly value={selectedTransRestData.full_menu || ''} className="w-full p-4 border rounded-xl text-sm font-medium bg-white text-gray-600" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Takeout Menu</label>
                         <textarea rows={3} readOnly value={selectedTransRestData.takeout_menu || ''} className="w-full p-4 border rounded-xl text-sm font-medium bg-white text-gray-600" />
                       </div>

                       {customTextFields.map((block: any) => {
                          const jsonKey = block.dbColumn.replace('custom_fields.', '');
                          const originalVal = selectedTransRestData.custom_fields?.[jsonKey] || '';
                          return (
                            <div key={block.id}>
                              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">{block.label}</label>
                              <textarea rows={2} readOnly value={originalVal} className="w-full p-4 border rounded-xl text-sm font-medium bg-white text-gray-600" />
                            </div>
                          );
                       })}

                       {selectedTransRestData.other_options && selectedTransRestData.other_options.length > 0 && (
                          <div className="pt-4 border-t border-gray-200 space-y-3">
                             <h4 className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Event Content</h4>
                             {selectedTransRestData.other_options.map((opt: string) => (
                                <div key={opt} className="bg-white p-4 rounded-xl border">
                                   <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block mb-1">{opt}</label>
                                   <textarea rows={2} readOnly value={selectedTransRestData.category_collabs?.[opt] || ''} className="w-full p-2 border-0 bg-transparent text-xs font-medium text-gray-600 outline-none resize-none" />
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>

                 {/* Right Column: Editable Translation Draft */}
                 <div className="space-y-6">
                    <h3 className="font-black text-blue-600 border-b border-blue-200 pb-2">Target Translation</h3>
                    <div className="space-y-4">
                       <div>
                         <div className="flex justify-between items-end mb-1">
                           <label className="text-[10px] font-black text-blue-400 uppercase ml-1">Title</label>
                           <button onClick={() => copyToDraft('title', selectedTransRestData.title)} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition bg-white px-2 py-0.5 rounded border shadow-sm">📋 Copy JA</button>
                         </div>
                         <input type="text" value={transDraft.title} onChange={(e) => setTransDraft({...transDraft, title: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-bold bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated title..." />
                       </div>
                       <div>
                         <div className="flex justify-between items-end mb-1">
                           <label className="text-[10px] font-black text-blue-400 uppercase ml-1">Description</label>
                           <button onClick={() => copyToDraft('description', selectedTransRestData.description)} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition bg-white px-2 py-0.5 rounded border shadow-sm">📋 Copy JA</button>
                         </div>
                         <textarea rows={4} value={transDraft.description} onChange={(e) => setTransDraft({...transDraft, description: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-medium bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated description..." />
                       </div>
                       <div>
                         <div className="flex justify-between items-end mb-1">
                           <label className="text-[10px] font-black text-blue-400 uppercase ml-1">Full Menu</label>
                           <button onClick={() => copyToDraft('full_menu', selectedTransRestData.full_menu)} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition bg-white px-2 py-0.5 rounded border shadow-sm">📋 Copy JA</button>
                         </div>
                         <textarea rows={6} value={transDraft.full_menu} onChange={(e) => setTransDraft({...transDraft, full_menu: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-medium bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated menu..." />
                       </div>
                       <div>
                         <div className="flex justify-between items-end mb-1">
                           <label className="text-[10px] font-black text-blue-400 uppercase ml-1">Takeout Menu</label>
                           <button onClick={() => copyToDraft('takeout_menu', selectedTransRestData.takeout_menu)} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition bg-white px-2 py-0.5 rounded border shadow-sm">📋 Copy JA</button>
                         </div>
                         <textarea rows={3} value={transDraft.takeout_menu} onChange={(e) => setTransDraft({...transDraft, takeout_menu: e.target.value})} className="w-full p-4 border border-blue-100 rounded-xl text-sm font-medium bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Translated takeout menu..." />
                       </div>

                       {/* EDITABLE DYNAMIC CUSTOM FIELD TRANSLATIONS */}
                       {customTextFields.map((block: any) => {
                          const jsonKey = block.dbColumn.replace('custom_fields.', '');
                          const originalVal = selectedTransRestData.custom_fields?.[jsonKey] || '';
                          return (
                            <div key={block.id}>
                              <div className="flex justify-between items-end mb-1">
                                <label className="text-[10px] font-black text-blue-400 uppercase ml-1">{block.label}</label>
                                <button onClick={() => copyToDraft(jsonKey, originalVal, true)} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition bg-white px-2 py-0.5 rounded border shadow-sm">📋 Copy JA</button>
                              </div>
                              <textarea 
                                rows={2} 
                                value={transDraft.custom_fields?.[jsonKey] || ''} 
                                onChange={(e) => setTransDraft({
                                  ...transDraft, 
                                  custom_fields: { ...transDraft.custom_fields, [jsonKey]: e.target.value }
                                })} 
                                className="w-full p-4 border border-blue-100 rounded-xl text-sm font-medium bg-white text-blue-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                placeholder={`Translated ${block.label}...`} 
                              />
                            </div>
                          );
                       })}

                       {selectedTransRestData.other_options && selectedTransRestData.other_options.length > 0 && (
                          <div className="pt-4 border-t border-blue-200 space-y-3 bg-blue-50/30 p-4 rounded-3xl mt-4">
                             <h4 className="text-[9px] font-black text-blue-400 uppercase ml-2 tracking-widest">Translate Event Content</h4>
                             {selectedTransRestData.other_options.map((opt: string) => {
                                const originalVal = selectedTransRestData.category_collabs?.[opt] || '';
                                return (
                                  <div key={opt} className="bg-white/50 p-4 rounded-2xl border border-blue-100 shadow-inner">
                                     <div className="flex justify-between items-end mb-2">
                                       <label className="text-[9px] font-black text-gray-400 uppercase ml-1">{opt}</label>
                                       <button onClick={() => copyToDraft(opt, originalVal, false, true)} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition bg-white px-2 py-0.5 rounded border shadow-sm">📋 Copy JA</button>
                                     </div>
                                     <textarea rows={2} value={transDraft.category_collabs?.[opt] || ''} onChange={(e) => setTransDraft({...transDraft, category_collabs: { ...transDraft.category_collabs, [opt]: e.target.value }})} className="w-full p-3 border border-blue-50 rounded-xl text-[12px] font-medium text-blue-900 bg-white focus:outline-none focus:border-blue-300" placeholder={`Local info for ${opt}...`} />
                                  </div>
                                )
                             })}
                          </div>
                       )}
                    </div>
                 </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}