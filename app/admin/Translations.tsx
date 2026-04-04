// Translations.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Translations({
  appLanguages,
  setAppLanguages,
  uiTranslations,
  setUiTranslations,
  masterFilters,
  setMasterFilters,
  liveRestaurants,
  pendingSubmissions, // Kept in props so App.tsx doesn't complain, but we won't use it here
  fetchAllData,
  updateBaseTagName
}: any) {
  const [transSubTab, setTransSubTab] = useState<'global' | 'tags' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  const [transDraft, setTransDraft] = useState({ title: '', description: '', full_menu: '', takeout_menu: '', category_collabs: {} as any });
  const [savingTrans, setSavingTrans] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');

  const translationLangs = appLanguages.filter((lang: any) => lang.code !== 'ja');
  
  // Only use live (approved) restaurants for translations
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

    // Tally up all existing data for this language
    const uiCount = uiTranslations.filter((t: any) => t.values && t.values[code]).length;
    const tagCount = masterFilters.filter((f: any) => f.translations && f.translations[code]).length;
    const restCount = translatableRestaurants.filter((r: any) => r.translations && r.translations[code] && Object.keys(r.translations[code]).length > 0).length;

    const warningMessage = `Are you absolutely sure you want to delete the language "${name}" (${code})?\n\nThis will permanently remove access to:\n• ${uiCount} UI Dictionary translations\n• ${tagCount} Tag translations\n• ${restCount} Restaurant translations\n\nThis action cannot be easily undone. Proceed?`;

    if (confirm(warningMessage)) {
      const { error } = await supabase.from('app_languages').delete().eq('code', code);
      if (error) {
        alert(`Error deleting language: ${error.message}`);
      } else {
        fetchAllData();
        if (selectedTransLang === code) {
          setSelectedTransLang('');
        }
      }
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
                  {l.code !== 'ja' && (
                    <button 
                      onClick={() => deleteLanguage(l.code, l.name)}
                      className="w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-800 hover:bg-red-500 hover:text-white rounded-full text-[10px] transition-colors"
                      title="Delete Language"
                    >
                      ✕
                    </button>
                  )}
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
                      <input type="text" value={newTransKey} onChange={(e) => setNewTransKey(e.target.value)} placeholder="New Key (e.g. badge_limited)" className="w-full p-2 border border-blue-200 rounded-lg text-sm font-bold bg-blue-50" />
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
                    <td><button onClick={() => deleteTranslationKey(trans.translation_key)} className="text-red-300">✕</button></td>
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
                <th className="p-3 text-xs font-black text-gray-400 uppercase w-32">Type</th>
                <th className="p-3 text-xs font-black text-gray-400 uppercase">Tag (JA)</th>
                {translationLangs.map((l: any) => (
                  <th key={l.code} className="p-3 text-xs font-black text-blue-600 uppercase">{l.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {masterFilters.map((filter: any) => (
                <tr key={filter.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="p-3 text-xs font-bold text-gray-400 uppercase tracking-widest">{filter.type}</td>
                  <td className="p-3">
                    <input 
                      type="text" 
                      defaultValue={filter.name}
                      onBlur={(e) => updateBaseTagName(filter.id, filter.name, e.target.value, filter.type)}
                      className="w-full p-3 font-bold text-gray-900 bg-transparent border border-transparent rounded-xl focus:border-orange-300 focus:bg-white outline-none" 
                    />
                  </td>
                  {translationLangs.map((l: any) => (
                    <td key={l.code} className="p-2">
                      <input 
                        type="text" 
                        value={filter.translations?.[l.code] || ''} 
                        onChange={(e) => { 
                          const ut = { ...filter.translations, [l.code]: e.target.value }; 
                          setMasterFilters(masterFilters.map((f: any) => f.id === filter.id ? {...f, translations: ut} : f)); 
                        }}
                        onBlur={async (e) => { 
                          const ut = { ...filter.translations, [l.code]: e.target.value }; 
                          await supabase.from('filter_options').update({ translations: ut }).eq('id', filter.id); 
                          fetchAllData(); 
                        }} 
                        className="w-full p-3 border border-gray-100 rounded-xl text-sm focus:border-blue-400 outline-none" 
                      />
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
                 <div className="space-y-4 bg-gray-50 p-6 rounded-3xl">
                    <h3 className="text-xs font-black text-gray-400 uppercase">🇯🇵 Japanese Base</h3>
                    <div className="p-4 bg-white border rounded-2xl font-bold text-gray-900">{selectedTransRestData.title}</div>
                    <div className="p-4 bg-white border rounded-2xl text-gray-700 whitespace-pre-wrap">{selectedTransRestData.description}</div>
                 </div>
                 <div className="space-y-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                    <h3 className="text-xs font-black text-blue-600 uppercase">🌐 {selectedTransLang.toUpperCase()} Translation</h3>
                    <input type="text" value={transDraft.title} onChange={(e) => setTransDraft(prev => ({...prev, title: e.target.value}))} className="w-full p-4 border border-blue-200 rounded-2xl font-bold" placeholder="Translated Title" />
                    <textarea rows={6} value={transDraft.description} onChange={(e) => setTransDraft(prev => ({...prev, description: e.target.value}))} className="w-full p-4 border border-blue-200 rounded-2xl" placeholder="Translated Description" />
                 </div>
               </div>
               <button onClick={saveRestaurantTranslation} disabled={savingTrans} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-blue-700 transition disabled:opacity-50">
                 {savingTrans ? 'SAVING...' : 'SAVE TRANSLATION'}
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}