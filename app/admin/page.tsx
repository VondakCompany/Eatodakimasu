'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'waseda2026';

  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'translations'>('directory');
  const [loading, setLoading] = useState(true);
  
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  
  // Translation Engine States
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiTranslations, setUiTranslations] = useState<any[]>([]);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');

  // Restaurant Content Translation States
  const [transSubTab, setTransSubTab] = useState<'global' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  const [transDraft, setTransDraft] = useState({ title: '', description: '', full_menu: '', takeout_menu: '' });
  const [savingTrans, setSavingTrans] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingData, setEditingData] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (isAuthenticated) fetchAllData();
  }, [isAuthenticated]);

  const fetchAllData = async () => {
    setLoading(true);
    const [pending, approved, categories, langs, trans] = await Promise.all([
      supabase.from('restaurants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('custom_categories').select('*').order('created_at', { ascending: true }),
      supabase.from('app_languages').select('*').order('code', { ascending: true }),
      supabase.from('ui_translations').select('*').order('translation_key', { ascending: true })
    ]);

    if (pending.data) setPendingSubmissions(pending.data);
    if (approved.data) setLiveRestaurants(approved.data);
    if (categories.data) setCustomCategories(categories.data);
    if (langs.data) setAppLanguages(langs.data);
    if (trans.data) setUiTranslations(trans.data);
    setLoading(false);
  };

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
          takeout_menu: existingTrans.takeout_menu || ''
        });
      }
    }
  }, [selectedTransRestId, selectedTransLang, liveRestaurants, pendingSubmissions]);

  // --- TRANSLATION LOGIC ---
  const addLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangCode.trim() || !newLangName.trim()) return;
    const { error } = await supabase.from('app_languages').insert([{ code: newLangCode.trim().toLowerCase(), name: newLangName.trim() }]);
    if (error) alert('Error: ' + error.message);
    else { setNewLangCode(''); setNewLangName(''); fetchAllData(); }
  };

  const addTranslationKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransKey.trim()) return;
    const safeKey = newTransKey.trim().toLowerCase().replace(/\s+/g, '_');
    const { error } = await supabase.from('ui_translations').insert([{ translation_key: safeKey, values: {} }]);
    if (error) alert('Error: ' + error.message);
    else { setNewTransKey(''); fetchAllData(); }
  };

  const updateTranslationValue = async (key: string, langCode: string, newValue: string) => {
    const currentTrans = uiTranslations.find(t => t.translation_key === key);
    if (!currentTrans) return;
    const updatedValues = { ...currentTrans.values, [langCode]: newValue };
    setUiTranslations(uiTranslations.map(t => t.translation_key === key ? { ...t, values: updatedValues } : t));
    await supabase.from('ui_translations').update({ values: updatedValues }).eq('translation_key', key);
  };

  const deleteTranslationKey = async (key: string) => {
    if (!confirm(`Delete translation key "${key}"?`)) return;
    await supabase.from('ui_translations').delete().eq('translation_key', key);
    fetchAllData();
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
    if (error) alert('Error: ' + error.message);
    else { alert('Saved successfully!'); fetchAllData(); }
  };

  // --- CATEGORY LOGIC ---
  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from('custom_categories').insert([{ name: newCategoryName.trim() }]);
    if (error) alert('Error: ' + error.message);
    else { setNewCategoryName(''); fetchAllData(); }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    await supabase.from('custom_categories').delete().eq('id', id);
    fetchAllData();
  };

  // --- RESTAURANT LOGIC ---
  const updateStatus = async (id: string, newStatus: string, title: string) => {
    const action = newStatus === 'approved' ? 'publish' : 'unpublish';
    if (!confirm(`Are you sure you want to ${action} "${title}"?`)) return;
    await supabase.from('restaurants').update({ status: newStatus }).eq('id', id);
    fetchAllData();
  };

  const deleteRestaurant = async (id: string, title: string) => {
    if (!confirm(`Permanently delete "${title}"?`)) return;
    await supabase.from('restaurants').delete().eq('id', id);
    fetchAllData();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
    if (error) alert('Upload failed: ' + error.message);
    else if (data) {
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
    if (!error) { alert('Successfully updated!'); setEditingData(null); fetchAllData(); } 
    else alert('Error: ' + error.message);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <form onSubmit={(e) => { e.preventDefault(); if (passwordInput === ADMIN_PASSWORD) setIsAuthenticated(true); }} className="max-w-md w-full bg-white p-10 rounded-3xl shadow-sm border border-gray-200 text-center">
          <h1 className="text-2xl font-black mb-6">CMS Login</h1>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" autoFocus className="w-full px-5 py-4 bg-gray-50 border rounded-xl mb-4 text-center tracking-widest outline-none" />
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl">Access</button>
        </form>
      </div>
    );
  }

  const translationLangs = appLanguages.filter(lang => lang.code !== 'ja');
  const allRestaurantsList = [...liveRestaurants, ...pendingSubmissions];
  const selectedTransRestData = allRestaurantsList.find(r => r.id === selectedTransRestId);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 relative">
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-black">Admin CMS</h1>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">Logout</button>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'directory' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Live Directory ({liveRestaurants.length})</button>
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Pending Approvals ({pendingSubmissions.length})</button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-md' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>⚙️ Categories</button>
        <button onClick={() => setActiveTab('translations')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'translations' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>🌐 Translations</button>
      </div>

      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-500 font-bold">Loading Database...</div>
      ) : (
        <>
          {/* --- TAB: TRANSLATIONS --- */}
          {activeTab === 'translations' && (
            <div className="space-y-8">
              <div className="flex gap-4 border-b border-gray-200 pb-4">
                <button onClick={() => setTransSubTab('global')} className={`pb-2 px-2 font-black border-b-2 transition ${transSubTab === 'global' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Global UI & Languages</button>
                <button onClick={() => setTransSubTab('restaurants')} className={`pb-2 px-2 font-black border-b-2 transition ${transSubTab === 'restaurants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Restaurant Content 📝</button>
              </div>

              {transSubTab === 'global' && (
                <>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
                    <h2 className="text-2xl font-black mb-2">Supported Languages</h2>
                    <form onSubmit={addLanguage} className="flex flex-wrap gap-4 mb-6 border-b border-gray-100 pb-8">
                      <input type="text" value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder="Code (e.g. ko)" maxLength={3} className="w-32 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                      <input type="text" value={newLangName} onChange={(e) => setNewLangName(e.target.value)} placeholder="Display Name (e.g. Korean)" className="flex-1 min-w-[200px] p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                      <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700">Add Language</button>
                    </form>
                    <div className="flex flex-wrap gap-3">
                      {appLanguages.map(lang => (
                        <span key={lang.code} className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-bold text-sm">{lang.name} ({lang.code})</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 overflow-x-auto">
                    <h2 className="text-2xl font-black mb-2">Global UI Dictionary</h2>
                    <form onSubmit={addTranslationKey} className="flex gap-4 mb-8">
                      <input type="text" value={newTransKey} onChange={(e) => setNewTransKey(e.target.value)} placeholder="New Key (e.g. btn_submit)" className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                      <button type="submit" className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800">Create Key</button>
                    </form>
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr>
                          <th className="p-3 border-b-2 border-gray-200 font-black text-gray-500 uppercase text-xs w-48">UI Key</th>
                          {appLanguages.map(lang => <th key={lang.code} className="p-3 border-b-2 border-gray-200 font-black text-blue-600 uppercase text-xs">{lang.name}</th>)}
                          <th className="p-3 border-b-2 border-gray-200 font-black text-gray-500 uppercase text-xs w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {uiTranslations.map(trans => (
                          <tr key={trans.translation_key} className="hover:bg-gray-50 transition border-b border-gray-100">
                            <td className="p-3 font-mono text-xs text-gray-600 font-bold">{trans.translation_key}</td>
                            {appLanguages.map(lang => (
                              <td key={lang.code} className="p-2">
                                <input type="text" value={trans.values?.[lang.code] || ''} onChange={(e) => updateTranslationValue(trans.translation_key, lang.code, e.target.value)} placeholder={`...`} className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white" />
                              </td>
                            ))}
                            <td className="p-3 text-right">
                              <button onClick={() => deleteTranslationKey(trans.translation_key)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {transSubTab === 'restaurants' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-gray-100 pb-8">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">1. Select Restaurant</label>
                      <select value={selectedTransRestId} onChange={(e) => setSelectedTransRestId(e.target.value)} className="w-full p-4 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500 bg-gray-50">
                        <option value="">-- Choose a Restaurant --</option>
                        {allRestaurantsList.map(r => <option key={r.id} value={r.id}>{r.title} {r.status === 'pending' ? '(Pending)' : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">2. Target Language</label>
                      <select value={selectedTransLang} onChange={(e) => setSelectedTransLang(e.target.value)} disabled={!selectedTransRestId || translationLangs.length === 0} className="w-full p-4 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500 bg-gray-50 disabled:opacity-50">
                        <option value="">-- Choose Language --</option>
                        {translationLangs.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {selectedTransRestId && selectedTransLang && selectedTransRestData ? (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                          <h3 className="text-sm font-black text-gray-500 uppercase flex items-center mb-4">🇯🇵 Base Content (Japanese)</h3>
                          <div><label className="block text-xs font-bold text-gray-400 mb-1">Title</label><div className="p-3 bg-white border border-gray-200 rounded-xl text-gray-800">{selectedTransRestData.title || 'Empty'}</div></div>
                          <div><label className="block text-xs font-bold text-gray-400 mb-1">Description</label><div className="p-3 bg-white border border-gray-200 rounded-xl text-gray-800 whitespace-pre-wrap min-h-[100px]">{selectedTransRestData.description || 'Empty'}</div></div>
                          <div><label className="block text-xs font-bold text-gray-400 mb-1">Full Menu</label><div className="p-3 bg-white border border-gray-200 rounded-xl text-gray-800 whitespace-pre-wrap min-h-[150px]">{selectedTransRestData.full_menu || 'Empty'}</div></div>
                          {selectedTransRestData.takeout_available && (
                            <div><label className="block text-xs font-bold text-gray-400 mb-1">Takeout Menu</label><div className="p-3 bg-white border border-gray-200 rounded-xl text-gray-800">{selectedTransRestData.takeout_menu || 'Empty'}</div></div>
                          )}
                        </div>

                        <div className="space-y-6 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                          <h3 className="text-sm font-black text-blue-600 uppercase flex items-center mb-4">🌐 Target Translation ({selectedTransLang.toUpperCase()})</h3>
                          <div><label className="block text-xs font-bold text-blue-400 mb-1">Title Translation</label><input type="text" value={transDraft.title} onChange={(e) => setTransDraft({...transDraft, title: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                          <div><label className="block text-xs font-bold text-blue-400 mb-1">Description Translation</label><textarea rows={4} value={transDraft.description} onChange={(e) => setTransDraft({...transDraft, description: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                          <div><label className="block text-xs font-bold text-blue-400 mb-1">Full Menu Translation</label><textarea rows={6} value={transDraft.full_menu} onChange={(e) => setTransDraft({...transDraft, full_menu: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                          {selectedTransRestData.takeout_available && (
                            <div><label className="block text-xs font-bold text-blue-400 mb-1">Takeout Menu Translation</label><input type="text" value={transDraft.takeout_menu} onChange={(e) => setTransDraft({...transDraft, takeout_menu: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                          )}
                        </div>
                      </div>
                      <button onClick={saveRestaurantTranslation} disabled={savingTrans} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition disabled:opacity-50 text-lg">
                        {savingTrans ? 'Saving...' : `Save ${selectedTransLang.toUpperCase()} Translations`}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                      <p className="text-gray-400 font-bold">Select a restaurant and a target language to start translating.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- TAB: MANAGE CATEGORIES --- */}
          {activeTab === 'categories' && (
            <div className="max-w-2xl bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-black mb-2">Dynamic CMS Categories</h2>
              <form onSubmit={addCategory} className="flex gap-4 mb-8 border-b border-gray-100 pb-8">
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New Category Name" className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-purple-500" />
                <button type="submit" className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-700 transition">Add</button>
              </form>
              <div className="space-y-3">
                {customCategories.length === 0 ? <p className="text-gray-400 italic">No custom categories created yet.</p> : customCategories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="font-bold text-gray-800">{cat.name}</span>
                    <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-red-500 text-sm font-bold hover:underline">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- TAB: DIRECTORY & PENDING --- */}
          {(activeTab === 'directory' || activeTab === 'pending') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeTab === 'directory' ? liveRestaurants : pendingSubmissions).map(restaurant => (
                <div key={restaurant.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                  {restaurant.image_url && <img src={restaurant.image_url} alt="Cover" className="w-full h-32 object-cover rounded-xl mb-4 bg-gray-100" />}
                  <h3 className="text-lg font-black text-gray-900 truncate">{restaurant.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Price: ¥{restaurant.restaurant_price || 'N/A'}</p>
                  
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setEditingData(restaurant)} className="flex-1 bg-blue-50 text-blue-600 text-xs font-bold py-2 rounded-lg hover:bg-blue-100 transition">✏️ Edit</button>
                    {activeTab === 'directory' ? (
                      <>
                        <button onClick={() => updateStatus(restaurant.id, 'pending', restaurant.title)} className="flex-1 bg-yellow-50 text-yellow-700 text-xs font-bold py-2 rounded-lg hover:bg-yellow-100">Unpublish</button>
                        <button onClick={() => deleteRestaurant(restaurant.id, restaurant.title)} className="flex-1 bg-red-50 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-100">Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => updateStatus(restaurant.id, 'approved', restaurant.title)} className="flex-1 bg-green-50 text-green-700 text-xs font-bold py-2 rounded-lg hover:bg-green-100">Approve</button>
                        <button onClick={() => deleteRestaurant(restaurant.id, restaurant.title)} className="flex-1 bg-red-50 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-100">Reject</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- EDIT MODAL --- */}
      {editingData && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative">
            <div className="sticky top-0 bg-white/95 backdrop-blur z-10 p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-2xl font-black text-gray-900">Editing: {editingData.title}</h2>
              <button onClick={() => setEditingData(null)} className="text-gray-400 hover:text-red-500 text-2xl font-bold bg-gray-100 hover:bg-red-50 w-10 h-10 rounded-full flex items-center justify-center transition">✕</button>
            </div>
            
            <div className="p-6 md:p-8 space-y-12">
              <section className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                <h3 className="text-lg font-black text-purple-900 mb-4 flex items-center">⚙️ Dynamic CMS Categories</h3>
                {customCategories.length === 0 ? <p className="text-sm text-purple-700">No custom categories have been created yet.</p> : (
                  <div className="flex flex-wrap gap-3">
                    {customCategories.map(cat => (
                      <label key={cat.id} className="flex items-center cursor-pointer px-4 py-2 bg-white border border-purple-200 rounded-xl hover:bg-purple-100 transition shadow-sm">
                        <input type="checkbox" checked={(editingData.other_options || []).includes(cat.name)} onChange={() => toggleEditArray('other_options', cat.name)} className="mr-3 h-5 w-5 accent-purple-600" />
                        <span className="text-sm font-black text-purple-900">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
              
              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">1. Photo & Core Identity</h3>
                <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-200">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cover Photo</label>
                  {editingData.image_url ? <img src={editingData.image_url} alt="Preview" className="w-full max-w-sm h-40 object-cover rounded-xl mb-4 shadow-sm" /> : <div className="w-full max-w-sm h-40 bg-gray-200 rounded-xl mb-4 flex items-center justify-center text-gray-400 text-sm font-bold">No Image</div>}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs w-full" />
                </div>
                
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Title (Base)</label>
                    <input type="text" value={editingData.title || ''} onChange={(e) => setEditingData({...editingData, title: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description (Base)</label>
                    <textarea rows={3} value={editingData.description || ''} onChange={(e) => setEditingData({...editingData, description: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <p className="text-xs text-blue-500 font-bold mt-4">💡 Note: To add translations, use the "Translations" tab on the main dashboard.</p>
              </section>

              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">2. Search Filters</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Cuisine</label>
                    <div className="flex flex-wrap gap-2">
                      {['和食', '洋食', '中華', '韓国料理', 'インド料理', '東南アジア', 'ファストフード', 'カフェ・スイーツ', '寿司', '丼もの'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><input type="checkbox" checked={(editingData.cuisine || []).includes(opt)} onChange={() => toggleEditArray('cuisine', opt)} className="mr-2 accent-orange-600" /><span className="text-sm text-gray-700 font-bold">{opt}</span></label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Dietary</label>
                    <div className="flex flex-wrap gap-2">
                      {['ハラール', 'コーシャ', 'ヴィーガン', 'ベジタリアン', 'グルテンフリー', '乳製品不使用', 'ペスカタリアン'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><input type="checkbox" checked={(editingData.food_restrictions || []).includes(opt)} onChange={() => toggleEditArray('food_restrictions', opt)} className="mr-2 accent-green-600" /><span className="text-sm text-gray-700 font-bold">{opt}</span></label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Payments</label>
                    <div className="flex flex-wrap gap-2">
                      {['現金', 'クレジットカード', 'デビットカード', 'QRコード決済', '電子マネー', '銀行振込'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><input type="checkbox" checked={(editingData.payment_methods || []).includes(opt)} onChange={() => toggleEditArray('payment_methods', opt)} className="mr-2 accent-blue-600" /><span className="text-sm text-gray-700 font-bold">{opt}</span></label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">3. Menus & Takeout</h3>
                <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Menu (Base)</label>
                  <textarea rows={8} value={editingData.full_menu || ''} onChange={(e) => setEditingData({...editingData, full_menu: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. カレー ... ¥800" />
                </div>
                <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100">
                  <label className="flex items-center cursor-pointer mb-4">
                    <input type="checkbox" checked={editingData.takeout_available || false} onChange={(e) => setEditingData({...editingData, takeout_available: e.target.checked})} className="h-6 w-6 accent-orange-600 mr-3" />
                    <span className="text-lg font-black text-gray-900">Takeout Available</span>
                  </label>
                  {editingData.takeout_available && (
                    <div className="border-t border-orange-200 pt-4 mt-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Takeout Menu (Base)</label>
                      <input type="text" value={editingData.takeout_menu || ''} onChange={(e) => setEditingData({...editingData, takeout_menu: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">4. Location & Contact Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Public Address</label>
                    <input type="text" value={editingData.address || ''} onChange={(e) => setEditingData({...editingData, address: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Website URL</label>
                    <input type="text" value={editingData.website_url || ''} onChange={(e) => setEditingData({...editingData, website_url: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Restaurant Area</label>
                    <input type="text" placeholder="Comma separated" value={(editingData.restaurant_area || []).join(', ')} onChange={(e) => setEditingData({...editingData, restaurant_area: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                </div>
                <div className="p-5 bg-red-50 rounded-2xl border border-red-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-1 md:col-span-3">
                    <p className="text-xs font-black text-red-600 uppercase tracking-widest">🔒 Private Owner Contact Info</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Owner Name</label>
                    <input type="text" value={editingData.contact_name || ''} onChange={(e) => setEditingData({...editingData, contact_name: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
                    <input type="text" value={editingData.contact_email || ''} onChange={(e) => setEditingData({...editingData, contact_email: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Phone</label>
                    <input type="text" value={editingData.contact_phone || ''} onChange={(e) => setEditingData({...editingData, contact_phone: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">5. Operations & Services</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Budget</label>
                    <input type="number" value={editingData.restaurant_price || ''} onChange={(e) => setEditingData({...editingData, restaurant_price: parseInt(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Total Seats</label>
                    <input type="text" value={editingData.total_seats || ''} onChange={(e) => setEditingData({...editingData, total_seats: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Avg Stay</label>
                    <input type="text" value={editingData.avg_stay_time || ''} onChange={(e) => setEditingData({...editingData, avg_stay_time: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div className="flex items-center pt-6 gap-4 col-span-2 md:col-span-1">
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={editingData.atom_currency || false} onChange={(e) => setEditingData({...editingData, atom_currency: e.target.checked})} className="h-5 w-5 accent-orange-600 mr-2" />
                      <span className="text-sm font-bold text-gray-800">Atom Currency</span>
                    </label>
                  </div>
                  <div className="flex items-center pt-6 gap-4 col-span-2 md:col-span-1">
                     <label className="flex items-center cursor-pointer p-2 bg-pink-50 rounded-lg border border-pink-100">
                      <input type="checkbox" checked={editingData.participates_in_event || false} onChange={(e) => setEditingData({...editingData, participates_in_event: e.target.checked})} className="h-5 w-5 accent-pink-600 mr-2" />
                      <span className="text-sm font-bold text-pink-900">Event Active</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Special Offers</label>
                  <textarea rows={2} value={editingData.discount_info || ''} onChange={(e) => setEditingData({...editingData, discount_info: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                </div>
                <div className="mt-6">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Admin Notes (Hidden)</label>
                  <textarea rows={3} value={editingData.admin_notes || ''} onChange={(e) => setEditingData({...editingData, admin_notes: e.target.value})} className="w-full p-3 border border-gray-200 bg-yellow-50 rounded-xl outline-none" placeholder="Add any private team notes..." />
                </div>
              </section>

            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur z-10 p-6 border-t border-gray-100">
              <button onClick={saveEdits} className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 text-lg">
                Save All Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}