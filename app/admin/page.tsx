'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'waseda2026';

  // --- NAVIGATION & LOADING ---
  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'translations'>('directory');
  const [loading, setLoading] = useState(true);
  
  // --- DATABASE DATA ---
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiTranslations, setUiTranslations] = useState<any[]>([]);

  // --- MASTER DATA HUB STATES (Cuisine, Payment, Area, etc.) ---
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterType, setNewFilterType] = useState<'cuisine' | 'restriction' | 'payment' | 'area'>('cuisine');

  // --- TRANSLATION ENGINE STATES ---
  const [transSubTab, setTransSubTab] = useState<'global' | 'tags' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  const [transDraft, setTransDraft] = useState({ title: '', description: '', full_menu: '', takeout_menu: '', category_collabs: {} as any });
  const [savingTrans, setSavingTrans] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');

  // --- EDIT & EVENT STATES ---
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingData, setEditingData] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [categoryParticipants, setCategoryParticipants] = useState<string[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);

  // --- INITIAL FETCH ---
  useEffect(() => {
    if (isAuthenticated) fetchAllData();
  }, [isAuthenticated]);

  const fetchAllData = async () => {
    setLoading(true);
    const [pending, approved, categories, filters, langs, trans] = await Promise.all([
      supabase.from('restaurants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('custom_categories').select('*').order('created_at', { ascending: true }),
      supabase.from('filter_options').select('*').order('name', { ascending: true }),
      supabase.from('app_languages').select('*').order('code', { ascending: true }),
      supabase.from('ui_translations').select('*').order('translation_key', { ascending: true })
    ]);

    if (pending.data) setPendingSubmissions(pending.data);
    if (approved.data) setLiveRestaurants(approved.data);
    if (categories.data) setCustomCategories(categories.data);
    if (filters.data) setMasterFilters(filters.data);
    if (langs.data) setAppLanguages(langs.data);
    if (trans.data) setUiTranslations(trans.data);
    setLoading(false);
  };

  // --- TRANSLATION EFFECTS ---
  useEffect(() => {
    if (selectedTransRestId && selectedTransLang) {
      const allRests = [...liveRestaurants, ...pendingSubmissions];
      const rest = allRests.find(r => r.id === selectedTransRestId);
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
  }, [selectedTransRestId, selectedTransLang, liveRestaurants, pendingSubmissions]);

  // --- LOGIC: TRANSLATIONS ---
  const addLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangCode.trim() || !newLangName.trim()) return;
    const { error } = await supabase.from('app_languages').insert([{ code: newLangCode.trim().toLowerCase(), name: newLangName.trim() }]);
    if (!error) { setNewLangCode(''); setNewLangName(''); fetchAllData(); }
  };

  const addTranslationKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransKey.trim()) return;
    const safeKey = newTransKey.trim().toLowerCase().replace(/\s+/g, '_');
    const { error } = await supabase.from('ui_translations').insert([{ translation_key: safeKey, values: {} }]);
    if (!error) { setNewTransKey(''); fetchAllData(); }
  };

  const updateTranslationValue = async (key: string, langCode: string, newValue: string) => {
    const currentTrans = uiTranslations.find(t => t.translation_key === key);
    if (!currentTrans) return;
    const updatedValues = { ...currentTrans.values, [langCode]: newValue };
    setUiTranslations(uiTranslations.map(t => t.translation_key === key ? { ...t, values: updatedValues } : t));
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
    const allRests = [...liveRestaurants, ...pendingSubmissions];
    const rest = allRests.find(r => r.id === selectedTransRestId);
    if (!rest) return;
    const updatedTranslations = { ...(rest.translations || {}), [selectedTransLang]: transDraft };
    const { error } = await supabase.from('restaurants').update({ translations: updatedTranslations }).eq('id', selectedTransRestId);
    setSavingTrans(false);
    if (!error) { alert('Saved!'); fetchAllData(); }
  };

  // --- LOGIC: MASTER FILTERS ---
  const addMasterFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    const { error } = await supabase.from('filter_options').insert([{ 
      name: newFilterName.trim(), 
      type: newFilterType,
      translations: {} // Start empty, handle multi-lang dynamically
    }]);
    if (!error) { setNewFilterName(''); fetchAllData(); }
  };

  const deleteMasterFilter = async (id: string) => {
    if (confirm('Permanently delete this filter tag?')) {
      await supabase.from('filter_options').delete().eq('id', id);
      fetchAllData();
    }
  };

  // ✅ SMART CASCADING UPDATE: Changes tag name AND updates all connected restaurants
  const updateBaseTagName = async (id: string, oldName: string, newName: string, type: string) => {
    const safeNewName = newName.trim();
    if (!safeNewName || safeNewName === oldName) return;

    // 1. Update the tag table
    await supabase.from('filter_options').update({ name: safeNewName }).eq('id', id);

    // 2. Safely update all restaurants that use this tag so they don't lose their data
    const dbField = getDbField(type);
    const allRests = [...liveRestaurants, ...pendingSubmissions];
    
    const updatePromises = allRests.map(async (rest) => {
      const currentArray = rest[dbField] || [];
      if (currentArray.includes(oldName)) {
        const newArray = currentArray.map((item: string) => item === oldName ? safeNewName : item);
        return supabase.from('restaurants').update({ [dbField]: newArray }).eq('id', rest.id);
      }
    }).filter(Boolean);

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    fetchAllData();
  };

  // --- HELPER: MAP CMS TYPE TO DB COLUMN ---
  const getDbField = (type: string) => {
    switch (type) {
      case 'cuisine': return 'cuisine';
      case 'restriction': return 'food_restrictions';
      case 'payment': return 'payment_methods';
      case 'area': return 'restaurant_area';
      default: return type;
    }
  };

  // --- LOGIC: EVENT HUB (CATEGORIES) ---
  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from('custom_categories').insert([{ name: newCategoryName.trim() }]);
    if (!error) { setNewCategoryName(''); fetchAllData(); }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (confirm(`Delete event "${name}"?`)) {
      await supabase.from('custom_categories').delete().eq('id', id);
      fetchAllData();
    }
  };

  const openManageCategory = (categoryName: string) => {
    const allRests = [...liveRestaurants, ...pendingSubmissions];
    const participants = allRests.filter(r => (r.other_options || []).includes(categoryName)).map(r => r.id);
    setCategoryParticipants(participants);
    setManagingCategory(categoryName);
  };

  const toggleParticipant = (restId: string) => {
    if (categoryParticipants.includes(restId)) {
      setCategoryParticipants(categoryParticipants.filter(id => id !== restId));
    } else {
      setCategoryParticipants([...categoryParticipants, restId]);
    }
  };

  const saveCategoryParticipants = async () => {
    if (!managingCategory) return;
    setSavingParticipants(true);
    const allRests = [...liveRestaurants, ...pendingSubmissions];
    const updatePromises = allRests.map(async (r) => {
      const hasCat = (r.other_options || []).includes(managingCategory);
      const wantsCat = categoryParticipants.includes(r.id);
      if (hasCat !== wantsCat) {
        let newOptions = wantsCat ? [...(r.other_options || []), managingCategory] : (r.other_options || []).filter((c: string) => c !== managingCategory);
        return supabase.from('restaurants').update({ other_options: newOptions }).eq('id', r.id);
      }
    }).filter(Boolean);
    await Promise.all(updatePromises);
    setSavingParticipants(false);
    setManagingCategory(null);
    alert('Event participants updated!');
    fetchAllData();
  };

  // --- LOGIC: RESTAURANT ACTIONS ---
  const updateStatus = async (id: string, newStatus: string, title: string) => {
    if (confirm(`Change status of "${title}" to ${newStatus}?`)) {
      await supabase.from('restaurants').update({ status: newStatus }).eq('id', id);
      fetchAllData();
    }
  };

  const deleteRestaurant = async (id: string, title: string) => {
    if (confirm(`Delete "${title}"? This cannot be undone.`)) {
      await supabase.from('restaurants').delete().eq('id', id);
      fetchAllData();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
    if (!error && data) {
      const { data: publicData } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
      setEditingData({ ...editingData, image_url: publicData.publicUrl });
    }
    setUploadingImage(false);
  };

  const toggleEditArray = (field: string, value: string) => {
    const currentArray = editingData[field] || [];
    if (currentArray.includes(value)) setEditingData({ ...editingData, [field]: currentArray.filter((v: string) => v !== value) });
    else setEditingData({ ...editingData, [field]: [...currentArray, value] });
  };

  const saveEdits = async () => {
    if (!editingData) return;
    const { error } = await supabase.from('restaurants').update(editingData).eq('id', editingData.id);
    if (!error) { setEditingData(null); fetchAllData(); }
  };

  // --- RENDER HELPERS ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <form onSubmit={(e) => { e.preventDefault(); if (passwordInput === ADMIN_PASSWORD) setIsAuthenticated(true); }} className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-200 text-center">
          <h1 className="text-3xl font-black mb-6 text-gray-900">CMS Access</h1>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter Password" autoFocus className="w-full px-5 py-4 bg-gray-50 border rounded-xl mb-4 text-center tracking-widest outline-none focus:ring-2 focus:ring-orange-500" />
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition">Login</button>
        </form>
      </div>
    );
  }

  const translationLangs = appLanguages.filter(lang => lang.code !== 'ja');
  const allRestaurantsList = [...liveRestaurants, ...pendingSubmissions];
  const selectedTransRestData = allRestaurantsList.find(r => r.id === selectedTransRestId);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 relative min-h-screen pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin CMS</h1>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm font-bold text-gray-400 hover:text-red-500 transition">Logout</button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-3 mb-10">
        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'directory' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Directory ({liveRestaurants.length})</button>
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Pending ({pendingSubmissions.length})</button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-lg' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>⚙️ Category Hub</button>
        <button onClick={() => setActiveTab('translations')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'translations' ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>🌐 Translations</button>
      </div>

      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-400 font-black text-xl tracking-widest">CONNECTING TO DATABASE...</div>
      ) : (
        <>
          {/* TAB: TRANSLATIONS */}
          {activeTab === 'translations' && (
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
                      {appLanguages.map(l => <span key={l.code} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100">{l.name} ({l.code})</span>)}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 overflow-x-auto">
                    <h2 className="text-2xl font-black mb-4">UI Dictionary</h2>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-2">
                          <th className="p-3 text-xs font-black text-gray-400 uppercase">Key</th>
                          {appLanguages.map(l => <th key={l.code} className="p-3 text-xs font-black text-blue-600 uppercase">{l.name}</th>)}
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {uiTranslations.map(trans => (
                          <tr key={trans.translation_key} className="border-b border-gray-50">
                            <td className="p-3 font-mono text-xs font-bold text-gray-400">{trans.translation_key}</td>
                            {appLanguages.map(l => (
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

              {/* TAGS SPREADSHEET */}
              {transSubTab === 'tags' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 overflow-x-auto animate-in fade-in">
                  <h2 className="text-2xl font-black mb-4">Tag Translations</h2>
                  <p className="text-sm text-gray-500 mb-6">Translate your cuisines, dietary restrictions, and payment methods here. Editing the JA column will safely update all connected restaurants automatically.</p>
                  
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2">
                        <th className="p-3 text-xs font-black text-gray-400 uppercase w-32">Type</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase">Tag (JA)</th>
                        {translationLangs.map(l => (
                          <th key={l.code} className="p-3 text-xs font-black text-blue-600 uppercase">{l.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {masterFilters.map(filter => (
                        <tr key={filter.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="p-3 text-xs font-bold text-gray-400 uppercase tracking-widest">{filter.type}</td>
                          <td className="p-3">
                            {/* ✅ Editable Base Name (Triggers the cascading update) */}
                            <input 
                              type="text" 
                              defaultValue={filter.name}
                              onBlur={(e) => updateBaseTagName(filter.id, filter.name, e.target.value, filter.type)}
                              className="w-full p-3 font-bold text-gray-900 bg-transparent border border-transparent rounded-xl focus:border-orange-300 focus:bg-white outline-none" 
                            />
                          </td>
                          {translationLangs.map(l => (
                            <td key={l.code} className="p-2">
                              <input 
                                type="text" 
                                value={filter.translations?.[l.code] || ''} 
                                placeholder={`Translate to ${l.name}...`}
                                onChange={(e) => { 
                                  const ut = { ...filter.translations, [l.code]: e.target.value }; 
                                  setMasterFilters(masterFilters.map(f => f.id === filter.id ? {...f, translations: ut} : f)); 
                                }}
                                onBlur={async (e) => { 
                                  const ut = { ...filter.translations, [l.code]: e.target.value }; 
                                  await supabase.from('filter_options').update({ translations: ut }).eq('id', filter.id); 
                                  fetchAllData(); 
                                }} 
                                className="w-full p-3 border border-gray-100 rounded-xl text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none" 
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
                      {allRestaurantsList.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                    <select value={selectedTransLang} onChange={(e) => setSelectedTransLang(e.target.value)} disabled={!selectedTransRestId} className="p-4 border rounded-2xl font-bold bg-gray-50 disabled:opacity-50">
                      <option value="">-- Choose Language --</option>
                      {translationLangs.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
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
                            <input type="text" value={transDraft.title} onChange={(e) => setTransDraft({...transDraft, title: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl font-bold" placeholder="Translated Title" />
                            <textarea rows={6} value={transDraft.description} onChange={(e) => setTransDraft({...transDraft, description: e.target.value})} className="w-full p-4 border border-blue-200 rounded-2xl" placeholder="Translated Description" />
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
          )}

          {/* TAB: CATEGORY & MASTER HUB */}
          {activeTab === 'categories' && (
            <div className="max-w-6xl space-y-12 pb-20">
              
              {/* SECTION: EVENTS */}
              <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
                <h2 className="text-3xl font-black mb-2">🎉 Event Management (DMS)</h2>
                <p className="text-sm text-gray-500 mb-8 font-medium">Manage global event descriptions and bulk assign restaurants.</p>
                
                <form onSubmit={addCategory} className="flex gap-4 mb-10 border-b pb-10">
                  <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New Event Name" className="flex-1 p-4 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-purple-500" />
                  <button type="submit" className="bg-purple-600 text-white font-black px-10 rounded-2xl hover:bg-purple-700 transition shadow-lg">Create</button>
                </form>

                <div className="space-y-6">
                  {customCategories.map(cat => (
                    <div key={cat.id} className="bg-gray-50 rounded-3xl border border-gray-200 overflow-hidden">
                      <div className="p-6 flex justify-between items-center bg-white border-b border-gray-100">
                        <span className="font-black text-xl text-gray-900">{cat.name}</span>
                        <div className="flex gap-3">
                          <button onClick={() => openManageCategory(cat.name)} className="bg-purple-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md">👥 Participants</button>
                          <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-red-400 font-bold text-xs px-2">Delete</button>
                        </div>
                      </div>
                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Global Rules (JA)</label>
                          <textarea rows={4} value={cat.description || ''} className="w-full p-4 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="Main event description..." onBlur={async (e) => { await supabase.from('custom_categories').update({ description: e.target.value }).eq('id', cat.id); fetchAllData(); }} onChange={(e) => setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, description: e.target.value} : c))} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Global Rules (EN)</label>
                          <textarea rows={4} value={cat.translations?.en?.description || ''} className="w-full p-4 border border-blue-100 bg-blue-50/20 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="English event description..." onBlur={async (e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; await supabase.from('custom_categories').update({ translations: ut }).eq('id', cat.id); fetchAllData(); }} onChange={(e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, translations: ut} : c)); }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* SECTION: MASTER TAGS */}
              <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
                <h2 className="text-3xl font-black mb-2">🏷️ Master Filter Tags</h2>
                <p className="text-sm text-gray-500 mb-8 font-medium">Manage Cuisines, Dietary, Areas, and Payments site-wide.</p>

                <form onSubmit={addMasterFilter} className="flex flex-wrap gap-4 mb-10 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <select value={newFilterType} onChange={(e: any) => setNewFilterType(e.target.value)} className="p-3 border rounded-xl font-bold bg-white">
                    <option value="cuisine">🍜 Cuisine</option>
                    <option value="restriction">🥗 Dietary</option>
                    <option value="payment">💳 Payment</option>
                    <option value="area">🗺️ Area</option>
                  </select>
                  <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Tag Name" className="flex-1 p-3 border rounded-xl font-bold" />
                  <button type="submit" className="bg-orange-600 text-white font-black px-8 py-3 rounded-xl hover:bg-orange-700 transition">Add Tag</button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                  {['cuisine', 'restriction', 'payment', 'area'].map((type) => (
                    <div key={type} className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b-2 border-gray-100 pb-2">{type}s</h3>
                      <div className="flex flex-col gap-3">
                        {masterFilters.filter(f => f.type === type).map(filter => (
                          <div key={filter.id} className="group flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 transition shadow-sm relative">
                            {/* ✅ Editable Base Name in the Category Hub too! */}
                            <input 
                              type="text" 
                              defaultValue={filter.name}
                              onBlur={(e) => updateBaseTagName(filter.id, filter.name, e.target.value, filter.type)}
                              className="text-sm font-black text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-orange-300 focus:border-dashed w-4/5"
                            />
                            <button onClick={() => deleteMasterFilter(filter.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB: DIRECTORY & PENDING GRID */}
          {(activeTab === 'directory' || activeTab === 'pending') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(activeTab === 'directory' ? liveRestaurants : pendingSubmissions).map(restaurant => (
                <div key={restaurant.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-200 flex flex-col hover:shadow-xl transition-all duration-300">
                  {restaurant.image_url ? (
                    <img src={restaurant.image_url} alt="Cover" className="w-full h-40 object-cover rounded-2xl mb-5 bg-gray-50" />
                  ) : (
                    <div className="w-full h-40 bg-gray-100 rounded-2xl mb-5 flex items-center justify-center text-gray-300 text-xs font-black">NO PHOTO</div>
                  )}
                  <h3 className="text-xl font-black text-gray-900 truncate mb-1">{restaurant.title}</h3>
                  <p className="text-xs text-orange-500 font-bold mb-6">¥{restaurant.restaurant_price || '---'}</p>
                  
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setEditingData(restaurant)} className="flex-1 bg-gray-900 text-white text-xs font-black py-3 rounded-xl hover:bg-black">✏️ Edit</button>
                    {activeTab === 'directory' ? (
                      <button onClick={() => updateStatus(restaurant.id, 'pending', restaurant.title)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-black py-3 rounded-xl hover:bg-gray-200">Unpublish</button>
                    ) : (
                      <button onClick={() => updateStatus(restaurant.id, 'approved', restaurant.title)} className="flex-1 bg-green-600 text-white text-xs font-black py-3 rounded-xl hover:bg-green-700">Approve</button>
                    )}
                    <button onClick={() => deleteRestaurant(restaurant.id, restaurant.title)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- MODAL: BULK MANAGE CATEGORY PARTICIPANTS --- */}
      {managingCategory && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden">
            <div className="bg-purple-600 p-8 flex justify-between items-center text-white">
              <div>
                <h2 className="text-2xl font-black">Event Participants</h2>
                <p className="text-purple-200 text-sm font-bold">{managingCategory}</p>
              </div>
              <button onClick={() => setManagingCategory(null)} className="text-3xl font-black bg-purple-700 w-12 h-12 rounded-full flex items-center justify-center">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-3 bg-gray-50">
              {allRestaurantsList.sort((a,b) => a.title.localeCompare(b.title)).map(rest => {
                const isSelected = categoryParticipants.includes(rest.id);
                return (
                  <label key={rest.id} className={`flex justify-between items-center cursor-pointer p-5 rounded-2xl border-2 transition-all ${isSelected ? 'bg-purple-50 border-purple-300 shadow-sm scale-[1.02]' : 'bg-white border-transparent grayscale-[0.5]'}`}>
                    <span className={`font-black ${isSelected ? 'text-purple-900' : 'text-gray-400'}`}>{rest.title}</span>
                    <div className={`w-14 h-8 rounded-full p-1.5 transition-colors ${isSelected ? 'bg-purple-600' : 'bg-gray-200'}`}>
                      <div className={`bg-white w-5 h-5 rounded-full shadow-lg transform transition ${isSelected ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleParticipant(rest.id)} />
                  </label>
                );
              })}
            </div>

            <div className="p-8 bg-white border-t border-gray-100">
              <button onClick={saveCategoryParticipants} disabled={savingParticipants} className="w-full bg-purple-600 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-purple-700 transition disabled:opacity-50 text-lg">
                {savingParticipants ? 'SAVING...' : `Update ${categoryParticipants.length} Restaurants`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: RESTAURANT EDITOR --- */}
      {editingData && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col relative">
            <div className="sticky top-0 bg-white/90 backdrop-blur p-8 border-b border-gray-100 z-10 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-gray-900">Edit Details</h2>
                <p className="text-orange-500 font-bold">{editingData.title}</p>
              </div>
              <button onClick={() => setEditingData(null)} className="text-gray-400 hover:text-red-500 text-3xl font-black bg-gray-100 w-14 h-14 rounded-full flex items-center justify-center">✕</button>
            </div>

            <div className="p-10 space-y-16">
              
              {/* EVENT & COLLAB SECTION */}
              <section className="p-8 bg-purple-50 rounded-[32px] border border-purple-100">
                <h3 className="text-xl font-black text-purple-900 mb-6 flex items-center gap-2"><span>🎉</span> Participating Events & Shop Specifics</h3>
                <div className="grid grid-cols-1 gap-4">
                  {customCategories.map(cat => (
                    <div key={cat.id} className={`p-6 rounded-2xl border-2 transition ${editingData.other_options?.includes(cat.name) ? 'bg-white border-purple-400 shadow-md' : 'bg-white/50 border-gray-100 opacity-60'}`}>
                      <label className="flex items-center cursor-pointer mb-4">
                        <input type="checkbox" checked={editingData.other_options?.includes(cat.name)} onChange={() => toggleEditArray('other_options', cat.name)} className="mr-3 h-6 w-6 accent-purple-600" />
                        <span className="font-black text-lg">{cat.name}</span>
                      </label>
                      {editingData.other_options?.includes(cat.name) && (
                        <div className="animate-in slide-in-from-top-2">
                           <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-2">Shop Collaboration Text (JA)</label>
                           <textarea rows={2} value={editingData.category_collabs?.[cat.name] || ''} onChange={(e) => setEditingData({...editingData, category_collabs: { ...(editingData.category_collabs || {}), [cat.name]: e.target.value }})} placeholder="What is this shop doing for this specific event?" className="w-full p-4 border border-purple-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* DYNAMIC MASTER TAGS SECTION */}
              <section className="space-y-8">
                <h3 className="text-xl font-black text-gray-900 border-b pb-2">Master Filter Tags</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                  {['cuisine', 'restriction', 'payment', 'area'].map(type => {
                    const dbField = getDbField(type);
                    return (
                      <div key={type}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">{type}s</label>
                        <div className="flex flex-col gap-2">
                          {masterFilters.filter(f => f.type === type).map(opt => (
                            <label key={opt.id} className="flex items-center cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                              <input 
                                type="checkbox" 
                                checked={(editingData[dbField] || []).includes(opt.name)} 
                                onChange={() => toggleEditArray(dbField, opt.name)} 
                                className={`mr-3 h-5 w-5 ${type === 'cuisine' ? 'accent-orange-600' : type === 'restriction' ? 'accent-green-600' : 'accent-blue-600'}`} 
                              />
                              <span className="text-sm font-bold text-gray-700">{opt.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* CORE CONTENT */}
              <section className="space-y-8">
                 <h3 className="text-xl font-black text-gray-900 border-b pb-2">Basic Info</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Cover Photo</label>
                      <img src={editingData.image_url || '/images/default.jpg'} className="w-full h-48 object-cover rounded-3xl mb-4 border" alt="Preview" />
                      <input type="file" onChange={handleImageUpload} className="text-xs font-bold" />
                    </div>
                    <div className="space-y-4">
                      <input type="text" value={editingData.title || ''} onChange={(e) => setEditingData({...editingData, title: e.target.value})} className="w-full p-4 border rounded-2xl font-black text-lg" placeholder="Shop Title" />
                      <input type="number" value={editingData.restaurant_price || ''} onChange={(e) => setEditingData({...editingData, restaurant_price: parseInt(e.target.value)})} className="w-full p-4 border rounded-2xl font-bold" placeholder="Price (e.g. 1500)" />
                      <input type="text" value={editingData.address || ''} onChange={(e) => setEditingData({...editingData, address: e.target.value})} className="w-full p-4 border rounded-2xl font-bold" placeholder="Address" />
                    </div>
                 </div>
                 <textarea rows={5} value={editingData.description || ''} onChange={(e) => setEditingData({...editingData, description: e.target.value})} className="w-full p-6 border rounded-[32px] text-lg leading-relaxed" placeholder="Detailed Description..." />
                 <textarea rows={8} value={editingData.full_menu || ''} onChange={(e) => setEditingData({...editingData, full_menu: e.target.value})} className="w-full p-6 border rounded-[32px] bg-gray-50 font-medium" placeholder="Full Menu Details..." />
              </section>

              <button onClick={saveEdits} className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-6 rounded-[32px] shadow-2xl hover:shadow-orange-500/20 transition transform hover:-translate-y-1 text-xl">
                SAVE ALL CHANGES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}