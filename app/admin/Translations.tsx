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
  updateBaseTagName
}: any) {
  const [transSubTab, setTransSubTab] = useState<'global' | 'tags' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
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
    category_collabs: {} as any 
  });
  const [savingTrans, setSavingTrans] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const translationLangs = appLanguages.filter((lang: any) => lang.code !== 'ja');
  const translatableRestaurants = liveRestaurants;
  const selectedTransRestData = translatableRestaurants.find((r: any) => r.id === selectedTransRestId);

  useEffect(() => {
    if (selectedTransRestId && selectedTransLang) {
      const rest = translatableRestaurants.find((r: any) => r.id === selectedTransRestId);
      if (rest) {
        const existingTrans = rest.translations?.[selectedTransLang] || {};
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
          category_collabs: existingTrans.category_collabs || {}
        });
      }
    }
  }, [selectedTransRestId, selectedTransLang, translatableRestaurants]);

  const addLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangCode.trim() || !newLangName.trim()) return;
    const { error } = await supabase.from('app_languages').insert([{ code: newLangCode.trim().toLowerCase(), name: newLangName.trim() }]);
    if (!error) { setNewLangCode(''); setNewLangName(''); fetchAllData(); }
  };

  const deleteLanguage = async (code: string, name: string) => {
    if (code === 'ja') {
      alert("Action Denied: You cannot delete the base language (Japanese).");
      return;
    }
    if (confirm(`Are you absolutely sure you want to delete "${name}"?`)) {
      const { error } = await supabase.from('app_languages').delete().eq('code', code);
      if (!error) fetchAllData();
    }
  };

  const addTranslationKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransKey.trim()) return;
    const safeKey = newTransKey.trim().toLowerCase().replace(/\s+/g, '_');
    const { error } = await supabase.from('ui_translations').insert([{ translation_key: safeKey, values: {} }]);
    if (!error) { setNewTransKey(''); fetchAllData(); }
  };

  const updateTranslationValue = async (key: string, langCode: string, newValue: string) => {
    const currentTrans = uiTranslations.find((t: any) => t.translation_key === key);
    if (!currentTrans) return;
    const updatedValues = { ...currentTrans.values, [langCode]: newValue };
    setUiTranslations(uiTranslations.map((t: any) => t.translation_key === key ? { ...t, values: updatedValues } : t));
    await supabase.from('ui_translations').update({ values: updatedValues }).eq('translation_key', key);
  };

  const deleteTranslationKey = async (key: string) => {
    if (confirm(`Delete key "${key}"?`)) {
      await supabase.from('ui_translations').delete().eq('translation_key', key);
      fetchAllData();
    }
  };

  const saveRestaurantTranslation = async () => {
    if (!selectedTransRestId || !selectedTransLang) return;
    setSavingTrans(true);
    const rest = translatableRestaurants.find((r: any) => r.id === selectedTransRestId);
    if (!rest) return;
    const updatedTranslations = { ...(rest.translations || {}), [selectedTransLang]: transDraft };
    const { error } = await supabase.from('restaurants').update({ translations: updatedTranslations }).eq('id', selectedTransRestId);
    setSavingTrans(false);
    if (!error) { alert('Saved!'); fetchAllData(); }
  };

  return (
    <div className="space-y-10">
      <div className="flex gap-4 border-b border-gray-100 pb-2">
        <button onClick={() => setTransSubTab('global')} className={`pb-2 px-2 font-black border-b-4 transition ${transSubTab === 'global' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-300'}`}>Global UI</button>
        <button onClick={() => setTransSubTab('tags')} className={`pb-2 px-2 font-black border-b-4 transition ${transSubTab === 'tags' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-300'}`}>Master Tags</button>
        <button onClick={() => setTransSubTab('restaurants')} className={`pb-2 px-2 font-black border-b-4 transition ${transSubTab === 'restaurants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-300'}`}>Restaurant Content</button>
      </div>
      
      {transSubTab === 'global' && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-black mb-6">Supported Languages</h2>
            <form onSubmit={addLanguage} className="flex gap-4 mb-8">
              <input type="text" value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder="Code" className="w-24 p-3 border rounded-xl" />
              <input type="text" value={newLangName} onChange={(e) => setNewLangName(e.target.value)} placeholder="Language Name" className="flex-1 p-3 border rounded-xl" />
              <button type="submit" className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl">Add</button>
            </form>
            <div className="flex flex-wrap gap-3">
              {appLanguages.map((l: any) => (
                <div key={l.code} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100">
                  <span>{l.name} ({l.code})</span>
                  {l.code !== 'ja' && ( <button onClick={() => deleteLanguage(l.code, l.name)} className="w-5 h-5 flex items-center justify-center bg-blue-200 hover:bg-red-500 hover:text-white rounded-full"><Icons.Close className="w-3 h-3" /></button> )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 overflow-x-auto">
            <h2 className="text-2xl font-black mb-4">UI Dictionary</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2">
                  <th className="p-3 text-xs font-black text-gray-400 uppercase">Key</th>
                  {appLanguages.map((l: any) => <th key={l.code} className="p-3 text-xs font-black text-blue-600 uppercase">{l.name}</th>)}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="p-2">
                    <form onSubmit={addTranslationKey} className="flex">
                      <input type="text" value={newTransKey} onChange={(e) => setNewTransKey(e.target.value)} placeholder="New Key" className="w-full p-2 border border-blue-200 rounded-lg text-sm font-bold bg-blue-50" />
                    </form>
                  </td>
                  <td colSpan={appLanguages.length + 1}></td>
                </tr>
                {uiTranslations.map((trans: any) => (
                  <tr key={trans.translation_key} className="border-b border-gray-50">
                    <td className="p-3 font-mono text-xs font-bold text-gray-400">{trans.translation_key}</td>
                    {appLanguages.map((l: any) => (
                      <td key={l.code} className="p-2">
                        <input type="text" value={trans.values?.[l.code] || ''} onChange={(e) => updateTranslationValue(trans.translation_key, l.code, e.target.value)} className="w-full p-2 border border-gray-100 rounded-lg text-sm" />
                      </td>
                    ))}
                    <td><button onClick={() => deleteTranslationKey(trans.translation_key)} className="text-red-300 hover:text-red-500"><Icons.Close className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transSubTab === 'tags' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 overflow-x-auto animate-in fade-in">
          <h2 className="text-2xl font-black mb-4">Tag Translations</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2">
                <th className="p-3 text-xs font-black text-gray-400 uppercase w-48">Category Type</th>
                <th className="p-3 text-xs font-black text-gray-400 uppercase">Tag (JA)</th>
                {translationLangs.map((l: any) => ( <th key={l.code} className="p-3 text-xs font-black text-blue-600 uppercase">{l.name}</th> ))}
              </tr>
            </thead>
            <tbody>
              {masterFilters.map((filter: any) => (
                <tr key={filter.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="p-3 align-top">
                    <div className="relative flex flex-col" onMouseLeave={() => setOpenDropdownId(null)}>
                      <div onClick={() => setOpenDropdownId(openDropdownId === filter.id ? null : filter.id)} className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold uppercase bg-white cursor-pointer flex justify-between items-center transition-all hover:border-blue-400">
                        <span className="truncate pr-2">{filter.type || 'other'}</span>
                      </div>
                      {openDropdownId === filter.id && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col max-h-56 overflow-y-auto">
                          {['cuisine', 'restriction', 'payment', 'campus', 'seats', 'event', 'other'].map(opt => (
                            <div key={opt} onClick={async () => {
                                setMasterFilters(masterFilters.map((f: any) => f.id === filter.id ? { ...f, type: opt } : f));
                                await supabase.from('filter_options').update({ type: opt }).eq('id', filter.id);
                                setOpenDropdownId(null);
                              }} className={`p-3 text-xs font-bold uppercase cursor-pointer hover:bg-gray-100 ${filter.type === opt ? 'bg-blue-50 text-blue-700' : ''}`}> {opt} </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <input type="text" defaultValue={filter.name} onBlur={(e) => updateBaseTagName(filter.id, filter.name, e.target.value, filter.type)} className="w-full p-3 font-bold text-gray-900 bg-transparent border border-transparent rounded-xl focus:border-orange-300 focus:bg-white outline-none" />
                  </td>
                  {translationLangs.map((l: any) => (
                    <td key={l.code} className="p-2">
                      <input type="text" value={filter.translations?.[l.code] || ''} onChange={(e) => {
                        const ut = { ...filter.translations, [l.code]: e.target.value };
                        setMasterFilters(masterFilters.map((f: any) => f.id === filter.id ? {...f, translations: ut} : f));
                      }} onBlur={async (e) => {
                        const ut = { ...filter.translations, [l.code]: e.target.value };
                        await supabase.from('filter_options').update({ translations: ut }).eq('id', filter.id);
                      }} className="w-full p-3 border border-gray-100 rounded-xl text-sm focus:border-blue-400 outline-none" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transSubTab === 'restaurants' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <select value={selectedTransRestId} onChange={(e) => setSelectedTransRestId(e.target.value)} className="p-4 border rounded-2xl font-bold bg-gray-50">
              <option value="">-- Choose Restaurant --</option>
              {translatableRestaurants.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <select value={selectedTransLang} onChange={(e) => setSelectedTransLang(e.target.value)} disabled={!selectedTransRestId} className="p-4 border rounded-2xl font-bold bg-gray-50 disabled:opacity-50">
              <option value="">-- Choose Language --</option>
              {translationLangs.map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          {selectedTransRestId && selectedTransLang && selectedTransRestData && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* SOURCE DISPLAY (Mirroring Edit Modal) */}
                 <div className="space-y-4 bg-gray-50 p-8 rounded-[40px] border border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">Japanese Source Base</h3>
                    <div className="space-y-6">
                       <div className="bg-white p-5 rounded-2xl border shadow-sm">
                          <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Title</label>
                          <p className="font-black text-xl text-gray-900">{selectedTransRestData.title}</p>
                       </div>
                       <div className="bg-white p-5 rounded-2xl border shadow-sm">
                          <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Description</label>
                          <p className="text-sm font-medium leading-relaxed text-gray-700 whitespace-pre-wrap">{selectedTransRestData.description}</p>
                       </div>
                       <div className="bg-white p-5 rounded-2xl border shadow-sm">
                          <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Website URL</label>
                          <p className="text-xs text-blue-500 truncate">{selectedTransRestData.website_url || '-'}</p>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-2xl border shadow-sm h-32 overflow-y-auto">
                             <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Menu</label>
                             <p className="text-[10px] text-gray-600 whitespace-pre-wrap">{selectedTransRestData.full_menu || '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border shadow-sm h-32 overflow-y-auto">
                             <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Takeout</label>
                             <p className="text-[10px] text-gray-600 whitespace-pre-wrap">{selectedTransRestData.takeout_menu || '-'}</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-2xl border shadow-sm">
                             <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Seats</label>
                             <p className="text-[10px] font-bold">{selectedTransRestData.total_seats || '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border shadow-sm">
                             <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Stay Time</label>
                             <p className="text-[10px] font-bold">{selectedTransRestData.avg_stay_time || '-'}</p>
                          </div>
                       </div>
                       <div className="p-4 bg-orange-100/30 border border-orange-100 rounded-2xl">
                          <label className="text-[9px] font-black text-orange-400 uppercase block mb-1">Discounts</label>
                          <p className="text-[11px] font-medium text-orange-800">{selectedTransRestData.discount_info || '-'}</p>
                       </div>
                       <div className="p-4 bg-white border border-gray-100 rounded-2xl space-y-1">
                          <label className="text-[9px] font-black text-gray-300 uppercase block mb-1">Admin Metadata</label>
                          <p className="text-[9px] text-gray-400">Method: {selectedTransRestData.photo_method || '-'}</p>
                          <p className="text-[9px] text-gray-400 italic">Notes: {selectedTransRestData.admin_notes || '-'}</p>
                       </div>
                       {selectedTransRestData.other_options?.length > 0 && (
                          <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100 space-y-2">
                             <h4 className="text-[9px] font-black text-purple-400 uppercase">Event Localization</h4>
                             {selectedTransRestData.other_options.map((opt: string) => (
                                <div key={opt} className="text-[11px] font-bold text-purple-800">[{opt}] {selectedTransRestData.category_collabs?.[opt] || '-'}</div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>

                 {/* DRAFT INPUT (1:1 with Display) */}
                 <div className="space-y-4 bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 shadow-2xl shadow-blue-100">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">{selectedTransLang.toUpperCase()} Draft</h3>
                    
                    <div className="space-y-4">
                       <label className="text-[9px] font-black text-blue-400 uppercase ml-4 block -mb-3">Translated Title</label>
                       <input type="text" value={transDraft.title} onChange={(e) => setTransDraft({...transDraft, title: e.target.value})} className="w-full p-5 border border-blue-200 rounded-2xl font-black text-blue-900 shadow-sm" placeholder="Title" />
                       
                       <label className="text-[9px] font-black text-blue-400 uppercase ml-4 block -mb-3">Translated Description</label>
                       <textarea rows={4} value={transDraft.description} onChange={(e) => setTransDraft({...transDraft, description: e.target.value})} className="w-full p-5 border border-blue-200 rounded-2xl text-sm font-medium shadow-sm" placeholder="Description" />

                       <label className="text-[9px] font-black text-blue-400 uppercase ml-4 block -mb-3">Translated Website URL</label>
                       <input type="text" value={transDraft.website_url} onChange={(e) => setTransDraft({...transDraft, website_url: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl text-xs font-bold text-blue-600" placeholder="Website" />

                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-blue-400 uppercase ml-2 block mb-1">Menu Translation</label>
                            <textarea rows={6} value={transDraft.full_menu} onChange={(e) => setTransDraft({...transDraft, full_menu: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl text-[10px] font-medium" placeholder="..." />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-blue-400 uppercase ml-2 block mb-1">Takeout Translation</label>
                            <textarea rows={6} value={transDraft.takeout_menu} onChange={(e) => setTransDraft({...transDraft, takeout_menu: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl text-[10px] font-medium" placeholder="..." />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-blue-400 uppercase ml-2 block mb-1">Seats Label</label>
                            <input type="text" value={transDraft.total_seats} onChange={(e) => setTransDraft({...transDraft, total_seats: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl text-xs font-bold" placeholder="e.g. 30 seats" />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-blue-400 uppercase ml-2 block mb-1">Stay Time Label</label>
                            <input type="text" value={transDraft.avg_stay_time} onChange={(e) => setTransDraft({...transDraft, avg_stay_time: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl text-xs font-bold" placeholder="e.g. 1 hour" />
                          </div>
                       </div>

                       <label className="text-[9px] font-black text-blue-400 uppercase ml-4 block -mb-3">Translated Discounts</label>
                       <textarea rows={2} value={transDraft.discount_info} onChange={(e) => setTransDraft({...transDraft, discount_info: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl text-[11px] font-black text-blue-600" placeholder="Students get..." />
                       
                       <div className="bg-white/50 p-4 rounded-2xl border border-blue-100 space-y-4 shadow-inner">
                          <label className="text-[9px] font-black text-gray-400 uppercase block border-b border-blue-50 pb-1">Logistic Context Translation</label>
                          <input type="text" value={transDraft.photo_method} onChange={(e) => setTransDraft({...transDraft, photo_method: e.target.value})} className="w-full p-3 border border-blue-50 rounded-xl text-[10px] font-bold" placeholder="Photo Method Translation..." />
                          <textarea rows={2} value={transDraft.admin_notes} onChange={(e) => setTransDraft({...transDraft, admin_notes: e.target.value})} className="w-full p-3 border border-blue-50 rounded-xl text-[10px] italic" placeholder="Admin Notes Translation..." />
                       </div>

                       {selectedTransRestData.other_options?.length > 0 && (
                          <div className="mt-2 space-y-4">
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