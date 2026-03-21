'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'waseda2026';

  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'master_tags' | 'translations'>('directory');
  const [loading, setLoading] = useState(true);
  
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiTranslations, setUiTranslations] = useState<any[]>([]);

  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterType, setNewFilterType] = useState<'cuisine' | 'restriction' | 'payment'>('cuisine');
  const [transSubTab, setTransSubTab] = useState<'global' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  const [transDraft, setTransDraft] = useState({ title: '', description: '', full_menu: '', takeout_menu: '', category_collabs: {} as any });
  const [savingTrans, setSavingTrans] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingData, setEditingData] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [categoryParticipants, setCategoryParticipants] = useState<string[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);

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

  // --- LOGIC: MASTER FILTERS ---
  const addMasterFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    const { error } = await supabase.from('filter_options').insert([{ 
      name: newFilterName.trim(), 
      type: newFilterType,
      translations: { en: newFilterName.trim() } 
    }]);
    if (!error) { setNewFilterName(''); fetchAllData(); }
  };

  const deleteMasterFilter = async (id: string) => {
    if (confirm('Delete this filter tag?')) {
      await supabase.from('filter_options').delete().eq('id', id);
      fetchAllData();
    }
  };

  // --- LOGIC: EVENTS ---
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
    fetchAllData();
  };

  // --- LOGIC: RESTAURANTS ---
  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('restaurants').update({ status: newStatus }).eq('id', id);
    fetchAllData();
  };

  const deleteRestaurant = async (id: string) => {
    if (confirm('Permanently delete?')) {
      await supabase.from('restaurants').delete().eq('id', id);
      fetchAllData();
    }
  };

  const saveEdits = async () => {
    if (!editingData) return;
    const { error } = await supabase.from('restaurants').update(editingData).eq('id', editingData.id);
    if (!error) { setEditingData(null); fetchAllData(); }
  };

  const toggleEditArray = (field: string, value: string) => {
    const currentArray = editingData[field] || [];
    if (currentArray.includes(value)) setEditingData({ ...editingData, [field]: currentArray.filter((v: string) => v !== value) });
    else setEditingData({ ...editingData, [field]: [...currentArray, value] });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <form onSubmit={(e) => { e.preventDefault(); if (passwordInput === ADMIN_PASSWORD) setIsAuthenticated(true); }} className="max-w-md w-full bg-white p-10 rounded-3xl shadow-sm border border-gray-200 text-center">
          <h1 className="text-2xl font-black mb-6">CMS Access</h1>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" autoFocus className="w-full px-5 py-4 bg-gray-50 border rounded-xl mb-4 text-center outline-none focus:border-orange-500" />
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 relative">
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-black tracking-tight">Admin CMS</h1>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm font-bold text-gray-400 hover:text-gray-900">Logout</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <button onClick={() => setActiveTab('directory')} className={`px-5 py-2 rounded-full font-bold text-xs transition ${activeTab === 'directory' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Directory ({liveRestaurants.length})</button>
        <button onClick={() => setActiveTab('pending')} className={`px-5 py-2 rounded-full font-bold text-xs transition ${activeTab === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Pending ({pendingSubmissions.length})</button>
        <button onClick={() => setActiveTab('categories')} className={`px-5 py-2 rounded-full font-bold text-xs transition ${activeTab === 'categories' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>🎉 Events Hub</button>
        <button onClick={() => setActiveTab('master_tags')} className={`px-5 py-2 rounded-full font-bold text-xs transition ${activeTab === 'master_tags' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>🏷️ Master Tags</button>
        <button onClick={() => setActiveTab('translations')} className={`px-5 py-2 rounded-full font-bold text-xs transition ${activeTab === 'translations' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>🌐 Translations</button>
      </div>

      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-400 font-bold">Loading...</div>
      ) : (
        <>
          {/* TAB: DIRECTORY & PENDING (PREVIOUS CLEAN UI) */}
          {(activeTab === 'directory' || activeTab === 'pending') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeTab === 'directory' ? liveRestaurants : pendingSubmissions).map(restaurant => (
                <div key={restaurant.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full">
                  {restaurant.image_url && <img src={restaurant.image_url} alt="Cover" className="w-full h-32 object-cover rounded-xl mb-4 bg-gray-50" />}
                  <h3 className="text-lg font-black text-gray-900 truncate">{restaurant.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 mb-4 italic">¥{restaurant.restaurant_price || '---'}</p>
                  
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setEditingData(restaurant)} className="flex-1 bg-blue-50 text-blue-600 text-xs font-bold py-2 rounded-lg hover:bg-blue-100">Edit</button>
                    {activeTab === 'directory' ? (
                      <button onClick={() => updateStatus(restaurant.id, 'pending')} className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg hover:bg-gray-200">Unpublish</button>
                    ) : (
                      <button onClick={() => updateStatus(restaurant.id, 'approved')} className="flex-1 bg-green-50 text-green-700 text-xs font-bold py-2 rounded-lg hover:bg-green-100">Approve</button>
                    )}
                    <button onClick={() => deleteRestaurant(restaurant.id)} className="p-2 text-red-300 hover:text-red-500">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: EVENTS HUB */}
          {activeTab === 'categories' && (
            <div className="max-w-4xl space-y-6">
              <form onSubmit={addCategory} className="flex gap-4 mb-8 bg-white p-6 rounded-2xl border border-gray-100">
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Event Name" className="flex-1 p-3 border rounded-xl font-bold outline-none" />
                <button type="submit" className="bg-purple-600 text-white font-bold px-8 rounded-xl">Create Event</button>
              </form>
              <div className="grid grid-cols-1 gap-6">
                {customCategories.map(cat => (
                  <div key={cat.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-5 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                      <span className="font-black text-gray-800">{cat.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => openManageCategory(cat.name)} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase">👥 Manage Participants</button>
                        <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-red-400 font-bold text-[10px] px-2">Delete</button>
                      </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <textarea rows={3} value={cat.description || ''} className="w-full p-3 border rounded-xl text-sm" placeholder="Rules (JA)" onBlur={async (e) => { await supabase.from('custom_categories').update({ description: e.target.value }).eq('id', cat.id); fetchAllData(); }} onChange={(e) => setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, description: e.target.value} : c))} />
                      <textarea rows={3} value={cat.translations?.en?.description || ''} className="w-full p-3 border border-blue-100 bg-blue-50/10 rounded-xl text-sm" placeholder="Rules (EN)" onBlur={async (e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; await supabase.from('custom_categories').update({ translations: ut }).eq('id', cat.id); fetchAllData(); }} onChange={(e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, translations: ut} : c)); }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: MASTER TAGS (DEDICATED) */}
          {activeTab === 'master_tags' && (
            <div className="max-w-5xl space-y-8">
              <form onSubmit={addMasterFilter} className="flex flex-wrap gap-4 p-6 bg-white rounded-2xl border border-gray-200">
                <select value={newFilterType} onChange={(e: any) => setNewFilterType(e.target.value)} className="p-3 border rounded-xl font-bold">
                  <option value="cuisine">🍜 Cuisine</option>
                  <option value="restriction">🥗 Dietary</option>
                  <option value="payment">💳 Payment</option>
                </select>
                <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Tag Name" className="flex-1 p-3 border rounded-xl" />
                <button type="submit" className="bg-indigo-600 text-white font-bold px-8 rounded-xl">Add Master Tag</button>
              </form>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {['cuisine', 'restriction', 'payment'].map(type => (
                  <div key={type} className="space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">{type}s</h3>
                    <div className="flex flex-col gap-2">
                      {masterFilters.filter(f => f.type === type).map(filter => (
                        <div key={filter.id} className="group flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl hover:border-indigo-200">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700">{filter.name}</span>
                            <span className="text-[10px] text-blue-400 font-bold uppercase">{filter.translations?.en || '---'}</span>
                          </div>
                          <button onClick={() => deleteMasterFilter(filter.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* --- MODALS (EVENT MANAGER & EDITOR) --- */}
      {managingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col relative overflow-hidden">
            <div className="bg-purple-600 p-6 flex justify-between items-center text-white">
              <h2 className="text-xl font-black">{managingCategory} Participants</h2>
              <button onClick={() => setManagingCategory(null)} className="font-bold">✕ Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-gray-50">
              {allRestaurantsList.sort((a,b) => a.title.localeCompare(b.title)).map(rest => (
                <label key={rest.id} className="flex justify-between items-center cursor-pointer p-4 bg-white border border-gray-200 rounded-xl hover:bg-purple-50">
                  <span className="font-bold text-gray-700">{rest.title}</span>
                  <input type="checkbox" className="h-5 w-5 accent-purple-600" checked={categoryParticipants.includes(rest.id)} onChange={() => {
                    if (categoryParticipants.includes(rest.id)) setCategoryParticipants(categoryParticipants.filter(id => id !== rest.id));
                    else setCategoryParticipants([...categoryParticipants, rest.id]);
                  }} />
                </label>
              ))}
            </div>
            <div className="p-6 bg-white border-t">
              <button onClick={saveCategoryParticipants} disabled={savingParticipants} className="w-full bg-purple-600 text-white font-black py-4 rounded-xl shadow-lg disabled:opacity-50">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {editingData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative p-8">
             <div className="flex justify-between items-start mb-8 border-b pb-6">
               <h2 className="text-2xl font-black text-gray-900">Edit: {editingData.title}</h2>
               <button onClick={() => setEditingData(null)} className="text-gray-400 hover:text-red-500 font-bold">✕ Close</button>
             </div>
             
             <div className="space-y-12 pb-10">
               {/* EVENT ASSIGNMENT */}
               <section className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                  <h3 className="text-lg font-black text-purple-900 mb-4">Event Collaborations</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {customCategories.map(cat => (
                      <div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-100">
                        <label className="flex items-center cursor-pointer font-bold text-gray-800 mb-2">
                          <input type="checkbox" checked={editingData.other_options?.includes(cat.name)} onChange={() => toggleEditArray('other_options', cat.name)} className="mr-3 accent-purple-600" />
                          {cat.name}
                        </label>
                        {editingData.other_options?.includes(cat.name) && (
                          <textarea rows={2} value={editingData.category_collabs?.[cat.name] || ''} onChange={(e) => setEditingData({...editingData, category_collabs: { ...(editingData.category_collabs || {}), [cat.name]: e.target.value }})} placeholder="Unique shop collab text for this event..." className="w-full mt-2 p-2 border border-purple-100 rounded-lg text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
               </section>

               {/* DYNAMIC MASTER TAGS */}
               <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {['cuisine', 'restriction', 'payment'].map(type => (
                   <div key={type}>
                     <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 border-b pb-1">{type}s</h4>
                     <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {masterFilters.filter(f => f.type === type).map(opt => (
                          <label key={opt.id} className="flex items-center text-sm font-bold text-gray-700 cursor-pointer p-2 border border-transparent hover:bg-gray-50 rounded-lg transition">
                            <input type="checkbox" checked={(editingData[type === 'cuisine' ? 'cuisine' : type === 'restriction' ? 'food_restrictions' : 'payment_methods'] || []).includes(opt.name)} onChange={() => toggleEditArray(type === 'cuisine' ? 'cuisine' : type === 'restriction' ? 'food_restrictions' : 'payment_methods', opt.name)} className="mr-2" />
                            {opt.name}
                          </label>
                        ))}
                     </div>
                   </div>
                 ))}
               </section>

               <section className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 border-b pb-2">Core Content</h3>
                  <input type="text" value={editingData.title || ''} onChange={(e) => setEditingData({...editingData, title: e.target.value})} className="w-full p-4 border rounded-xl font-bold" />
                  <textarea rows={4} value={editingData.description || ''} onChange={(e) => setEditingData({...editingData, description: e.target.value})} className="w-full p-4 border rounded-xl" />
                  <button onClick={saveEdits} className="w-full bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg">Save All Changes</button>
               </section>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}