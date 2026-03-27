'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'waseda2026';

  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'translations'>('directory');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(''); 
  
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiTranslations, setUiTranslations] = useState<any[]>([]);

  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterType, setNewFilterType] = useState<'cuisine' | 'restriction' | 'payment' | 'area'>('cuisine');

  const [transSubTab, setTransSubTab] = useState<'global' | 'tags' | 'restaurants'>('global');
  const [selectedTransRestId, setSelectedTransRestId] = useState<string>('');
  const [selectedTransLang, setSelectedTransLang] = useState<string>('');
  const [transDraft, setTransDraft] = useState({ title: '', description: '', full_menu: '', takeout_menu: '', category_collabs: {} as any });
  const [savingTrans, setSavingTrans] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newTransKey, setNewTransKey] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryStartDate, setNewCategoryStartDate] = useState('');
  const [newCategoryEndDate, setNewCategoryEndDate] = useState('');
  const [newCategoryIsConstant, setNewCategoryIsConstant] = useState(false);
  
  const [editingData, setEditingData] = useState<any | null>(null);
  const editingDataRef = useRef<any>(null); 
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [categoryParticipants, setCategoryParticipants] = useState<string[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);

  const [batchStatus, setBatchStatus] = useState<{ total: number, current: number, isRunning: boolean } | null>(null);

  useEffect(() => {
    editingDataRef.current = editingData;
  }, [editingData]);

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

  const geocodeAddress = async (address: string) => {
    if (!address) return { lat: null, lng: null };
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        alert("Google Maps API Key is missing! Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local");
        return { lat: null, lng: null };
      }
      
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return { lat: null, lng: null };
  };

  const batchUpdateCoordinates = async () => {
    const allRests = [...liveRestaurants, ...pendingSubmissions];
    const targets = allRests.filter(r => !r.lat || !r.lng);

    if (targets.length === 0) {
      alert("All restaurants already have coordinates!");
      return;
    }

    if (!confirm(`Found ${targets.length} restaurants missing coordinates. Start batch update?`)) return;

    setBatchStatus({ total: targets.length, current: 0, isRunning: true });

    for (let i = 0; i < targets.length; i++) {
      const rest = targets[i];
      setBatchStatus(prev => prev ? { ...prev, current: i + 1 } : null);

      if (rest.address) {
        const { lat, lng } = await geocodeAddress(rest.address);
        if (lat && lng) {
          await supabase.from('restaurants').update({ lat, lng }).eq('id', rest.id);
        }
      }
      await new Promise(r => setTimeout(r, 200)); 
    }

    setBatchStatus(null);
    alert("Batch update complete!");
    fetchAllData();
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
          takeout_menu: existingTrans.takeout_menu || '',
          category_collabs: existingTrans.category_collabs || {}
        });
      }
    }
  }, [selectedTransRestId, selectedTransLang, liveRestaurants, pendingSubmissions]);

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

  const addMasterFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    const { error } = await supabase.from('filter_options').insert([{ 
      name: newFilterName.trim(), 
      type: newFilterType,
      translations: {} 
    }]);
    if (!error) { setNewFilterName(''); fetchAllData(); }
  };

  const deleteMasterFilter = async (id: string) => {
    if (confirm('Permanently delete this filter tag?')) {
      await supabase.from('filter_options').delete().eq('id', id);
      fetchAllData();
    }
  };

  const updateBaseTagName = async (id: string, oldName: string, newName: string, type: string) => {
    const safeNewName = newName.trim();
    if (!safeNewName || safeNewName === oldName) return;

    await supabase.from('filter_options').update({ name: safeNewName }).eq('id', id);

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

  const getDbField = (type: string) => {
    switch (type) {
      case 'cuisine': return 'cuisine';
      case 'restriction': return 'food_restrictions';
      case 'payment': return 'payment_methods';
      case 'area': return 'restaurant_area';
      default: return type;
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    const payload: any = { 
      name: newCategoryName.trim(),
      show_badge: false,
      is_constant: newCategoryIsConstant
    };
    if (newCategoryStartDate && !newCategoryIsConstant) payload.start_date = new Date(newCategoryStartDate).toISOString();
    if (newCategoryEndDate && !newCategoryIsConstant) payload.end_date = new Date(newCategoryEndDate).toISOString();

    const { error } = await supabase.from('custom_categories').insert([payload]);
    
    if (!error) { 
      setNewCategoryName(''); 
      setNewCategoryStartDate('');
      setNewCategoryEndDate('');
      setNewCategoryIsConstant(false);
      fetchAllData(); 
    }
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

  const updateStatus = async (restaurant: any, newStatus: string) => {
    if (confirm(`Change status of "${restaurant.title}" to ${newStatus}?`)) {
      setLoading(true);
      
      let updates: any = { status: newStatus };

      if (newStatus === 'approved' && restaurant.address && !restaurant.lat) {
        const { lat, lng } = await geocodeAddress(restaurant.address);
        if (lat && lng) {
          updates.lat = lat;
          updates.lng = lng;
        }
      }

      await supabase.from('restaurants').update(updates).eq('id', restaurant.id);
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
    
    try {
      const fileName = `cover-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;
      const { data, error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
      
      if (error) throw error;
      
      const { data: publicData } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
      setEditingData((prev: any) => {
        if (!prev) return prev;
        return { ...prev, image_url: publicData.publicUrl };
      });
    } catch (error: any) {
      alert(`Cover Image Upload Error:\n${error.message}`);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingImage(true);
    const newUrls: string[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `gallery-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;
        
        const { data, error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
        if (error) throw error;
        
        const { data: publicData } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
        newUrls.push(publicData.publicUrl);
      }
      
      if (newUrls.length > 0) {
        setEditingData((prev: any) => {
          if (!prev) return prev;
          const currentUrls = prev.image_urls || [];
          return { ...prev, image_urls: [...currentUrls, ...newUrls] };
        });
      }
    } catch (error: any) {
      alert(`Storage Error:\n${error.message}`);
    } finally {
      setUploadingImage(false);
      e.target.value = ''; 
    }
  };

  const removeGalleryImage = (index: number) => {
    setEditingData((prev: any) => {
      if (!prev?.image_urls) return prev;
      const updated = [...prev.image_urls];
      updated.splice(index, 1);
      return { ...prev, image_urls: updated };
    });
  };

  const toggleEditArray = (field: string, value: string) => {
    setEditingData((prev: any) => {
      if (!prev) return prev;
      const currentArray = prev[field] || [];
      if (currentArray.includes(value)) {
        return { ...prev, [field]: currentArray.filter((v: string) => v !== value) };
      }
      return { ...prev, [field]: [...currentArray, value] };
    });
  };

  // ✅ HELPER: Pre-formats legacy JSON strings when loading a restaurant into the Edit Modal
  const handleEditClick = (restaurant: any) => {
    let formattedHours = restaurant.operating_hours;
    if (formattedHours) {
      if (typeof formattedHours === 'string') {
        try {
          const parsed = JSON.parse(formattedHours);
          formattedHours = Object.entries(parsed).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
        } catch { /* Already text */ }
      } else if (typeof formattedHours === 'object') {
        formattedHours = Object.entries(formattedHours).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
      }
    }
    setEditingData({ ...restaurant, operating_hours: formattedHours });
  };

  const saveEdits = async (currentData: any) => {
    if (!currentData || !currentData.id) {
      alert("Error: Lost Restaurant ID during session. Please refresh the page.");
      return;
    }
    
    setLoading(true);
    
    const { id, created_at, ...updates } = currentData;

    const allRests = [...liveRestaurants, ...pendingSubmissions];
    const original = allRests.find(r => r.id === id);
    if (original && original.address !== updates.address && updates.address) {
      const { lat, lng } = await geocodeAddress(updates.address);
      if (lat && lng) {
        updates.lat = lat;
        updates.lng = lng;
      }
    }
    
    const { error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', id);
    
    setLoading(false);

    if (error) { 
      alert(`Database Error:\n${error.message}`);
    } else { 
      alert(`✅ Saved Successfully!`);
      setEditingData(null); 
      fetchAllData(); 
    }
  };

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

  const filteredRestaurants = (activeTab === 'directory' ? liveRestaurants : pendingSubmissions).filter(rest => {
    if (!searchQuery.trim()) return true;
    return rest.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 relative min-h-screen pb-20">
      
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin CMS</h1>
          <button 
            onClick={batchUpdateCoordinates} 
            disabled={batchStatus?.isRunning}
            className="mt-2 text-xs font-black bg-gray-100 text-gray-500 px-4 py-2 rounded-full hover:bg-orange-100 hover:text-orange-600 transition disabled:opacity-50"
          >
            {batchStatus?.isRunning 
              ? `⚙️ Syncing... (${batchStatus.current}/${batchStatus.total})` 
              : "📍 Missing Coordinates Sync"}
          </button>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm font-bold text-gray-400 hover:text-red-500 transition">Logout</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <button onClick={() => { setActiveTab('directory'); setSearchQuery(''); }} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'directory' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Directory ({liveRestaurants.length})</button>
        <button onClick={() => { setActiveTab('pending'); setSearchQuery(''); }} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Pending ({pendingSubmissions.length})</button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-lg' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>⚙️ Category Hub</button>
        <button onClick={() => setActiveTab('translations')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'translations' ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>🌐 Translations</button>
      </div>

      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-400 font-black text-xl tracking-widest">CONNECTING TO DATABASE...</div>
      ) : (
        <>
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
                        <tr className="border-b border-gray-100">
                          <td className="p-2">
                            <form onSubmit={addTranslationKey} className="flex">
                              <input type="text" value={newTransKey} onChange={(e) => setNewTransKey(e.target.value)} placeholder="New Key (e.g. badge_limited)" className="w-full p-2 border border-blue-200 rounded-lg text-sm font-bold bg-blue-50" />
                            </form>
                          </td>
                          <td colSpan={appLanguages.length + 1}></td>
                        </tr>
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

              {transSubTab === 'tags' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 overflow-x-auto animate-in fade-in">
                  <h2 className="text-2xl font-black mb-4">Tag Translations</h2>
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
                                onChange={(e) => { 
                                  const ut = { ...filter.translations, [l.code]: e.target.value }; 
                                  setMasterFilters(masterFilters.map(f => f.id === filter.id ? {...f, translations: ut} : f)); 
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
          )}

          {activeTab === 'categories' && (
            <div className="max-w-6xl space-y-12 pb-20">
              <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
                <h2 className="text-3xl font-black mb-2">🎉 Event Management (DMS)</h2>
                <form onSubmit={addCategory} className="flex flex-wrap items-center gap-4 mb-10 border-b pb-10 bg-gray-50 p-6 rounded-3xl">
                  <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New Event Name" className="flex-1 min-w-[200px] p-4 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-purple-500" />
                  
                  <label className="flex items-center cursor-pointer gap-2 px-2">
                    <input type="checkbox" checked={newCategoryIsConstant} onChange={(e) => setNewCategoryIsConstant(e.target.checked)} className="w-5 h-5 accent-purple-600" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Constant Event</span>
                  </label>

                  <div className={`flex items-center gap-3 ${newCategoryIsConstant ? 'opacity-30 pointer-events-none' : ''}`}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">START</span>
                    <input type="date" value={newCategoryStartDate} onChange={(e) => setNewCategoryStartDate(e.target.value)} className="p-4 border rounded-2xl font-bold text-gray-700" />
                  </div>
                  <div className={`flex items-center gap-3 ${newCategoryIsConstant ? 'opacity-30 pointer-events-none' : ''}`}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">END</span>
                    <input type="date" value={newCategoryEndDate} onChange={(e) => setNewCategoryEndDate(e.target.value)} className="p-4 border rounded-2xl font-bold text-gray-700" />
                  </div>
                  <button type="submit" className="bg-purple-600 text-white font-black px-10 py-4 rounded-2xl hover:bg-purple-700 transition shadow-lg w-full md:w-auto">Create Event</button>
                </form>

                <div className="space-y-6">
                  {customCategories.map(cat => (
                    <div key={cat.id} className="bg-gray-50 rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="p-6 flex justify-between items-center bg-white border-b border-gray-100">
                        <span className="font-black text-xl text-gray-900">{cat.name}</span>
                        <div className="flex gap-3">
                          <button onClick={() => openManageCategory(cat.name)} className="bg-purple-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md">👥 Participants</button>
                          <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-red-400 font-bold text-xs px-2 hover:bg-red-50 rounded-md">Delete</button>
                        </div>
                      </div>
                      
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-gray-100 bg-white items-end">
                        <div className="flex items-center h-full pb-3">
                           <label className="flex items-center cursor-pointer gap-3 p-3 border border-purple-200 bg-purple-50 rounded-xl w-full hover:bg-purple-100 transition">
                              <input type="checkbox" checked={cat.is_constant || false} 
                                     onChange={async (e) => { await supabase.from('custom_categories').update({ is_constant: e.target.checked }).eq('id', cat.id); fetchAllData(); }} 
                                     className="w-5 h-5 accent-purple-600" />
                              <span className="text-sm font-bold text-purple-900">Permanent Event</span>
                           </label>
                        </div>
                        <div className={cat.is_constant ? 'opacity-40 pointer-events-none' : ''}>
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Active Start Date</label>
                           <input type="date" value={cat.start_date ? cat.start_date.split('T')[0] : ''} 
                                  onChange={(e) => setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, start_date: e.target.value} : c))}
                                  onBlur={async (e) => { await supabase.from('custom_categories').update({ start_date: e.target.value ? new Date(e.target.value).toISOString() : null }).eq('id', cat.id); fetchAllData(); }}
                                  className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none" />
                        </div>
                        <div className={cat.is_constant ? 'opacity-40 pointer-events-none' : ''}>
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Active End Date</label>
                           <input type="date" value={cat.end_date ? cat.end_date.split('T')[0] : ''} 
                                  onChange={(e) => setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, end_date: e.target.value} : c))}
                                  onBlur={async (e) => { await supabase.from('custom_categories').update({ end_date: e.target.value ? new Date(e.target.value).toISOString() : null }).eq('id', cat.id); fetchAllData(); }}
                                  className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none" />
                        </div>
                        <div className="flex items-center h-full pb-3">
                           <label className="flex items-center cursor-pointer gap-3 p-3 border border-gray-200 rounded-xl w-full hover:bg-gray-50 transition">
                              <input type="checkbox" checked={cat.show_badge || false} 
                                     onChange={async (e) => { await supabase.from('custom_categories').update({ show_badge: e.target.checked }).eq('id', cat.id); fetchAllData(); }} 
                                     className="w-5 h-5 accent-purple-600" />
                              <span className="text-sm font-bold text-gray-700">Display Badge on Cards</span>
                           </label>
                        </div>
                      </div>

                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Global Rules (JA)</label>
                          <textarea rows={4} value={cat.description || ''} className="w-full p-4 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                                    onBlur={async (e) => { await supabase.from('custom_categories').update({ description: e.target.value }).eq('id', cat.id); fetchAllData(); }} 
                                    onChange={(e) => setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, description: e.target.value} : c))} />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Translated Name (EN)</label>
                            <input type="text" value={cat.translations?.en?.name || ''} className="w-full p-3 border border-blue-100 bg-blue-50/20 rounded-xl text-sm font-bold" 
                                   onBlur={async (e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, name: e.target.value } }; await supabase.from('custom_categories').update({ translations: ut }).eq('id', cat.id); fetchAllData(); }} 
                                   onChange={(e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, name: e.target.value } }; setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, translations: ut} : c)); }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Global Rules (EN)</label>
                            <textarea rows={2} value={cat.translations?.en?.description || ''} className="w-full p-4 border border-blue-100 bg-blue-50/20 rounded-2xl text-sm" 
                                      onBlur={async (e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; await supabase.from('custom_categories').update({ translations: ut }).eq('id', cat.id); fetchAllData(); }} 
                                      onChange={(e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; setCustomCategories(customCategories.map(c => c.id === cat.id ? {...c, translations: ut} : c)); }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
                <h2 className="text-3xl font-black mb-2">🏷️ Master Filter Tags</h2>
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
                            <input type="text" defaultValue={filter.name} 
                                   onBlur={(e) => updateBaseTagName(filter.id, filter.name, e.target.value, filter.type)}
                                   className="text-sm font-black text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-orange-300 w-4/5" />
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

          {(activeTab === 'directory' || activeTab === 'pending') && (
            <div>
              <div className="mb-8">
                <div className="relative shadow-sm rounded-3xl bg-white border border-gray-200 max-w-2xl">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by restaurant name..."
                    className="w-full pl-14 pr-12 py-4 bg-transparent rounded-3xl outline-none font-bold text-gray-800 text-lg focus:ring-2 focus:ring-orange-500/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {filteredRestaurants.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold">No restaurants found matching "{searchQuery}"</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredRestaurants.map(restaurant => (
                    <div key={restaurant.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-200 flex flex-col hover:shadow-xl transition-all duration-300">
                      {restaurant.image_url ? (
                        <img src={restaurant.image_url} alt="Cover" className="w-full h-40 object-cover rounded-2xl mb-5 bg-gray-50" />
                      ) : (
                        <div className="w-full h-40 bg-gray-100 rounded-2xl mb-5 flex items-center justify-center text-gray-300 text-xs font-black">NO PHOTO</div>
                      )}
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-xl font-black text-gray-900 truncate flex-1">{restaurant.title}</h3>
                        {restaurant.lat && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-black">📍 GEO</span>}
                      </div>
                      <p className="text-xs text-orange-500 font-bold mb-6">¥{restaurant.restaurant_price || '---'}</p>
                      <div className="flex gap-2 mt-auto">
                        <button onClick={() => handleEditClick(restaurant)} className="flex-1 bg-gray-900 text-white text-xs font-black py-3 rounded-xl hover:bg-black transition">✏️ Edit</button>
                        {activeTab === 'directory' ? (
                          <button onClick={() => updateStatus(restaurant, 'pending')} className="flex-1 bg-gray-100 text-gray-600 text-xs font-black py-3 rounded-xl hover:bg-gray-200 transition">Unpublish</button>
                        ) : (
                          <button onClick={() => updateStatus(restaurant, 'approved')} className="flex-1 bg-green-600 text-white text-xs font-black py-3 rounded-xl hover:bg-green-700 transition">Approve</button>
                        )}
                        <button onClick={() => deleteRestaurant(restaurant.id, restaurant.title)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

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
              <button onClick={saveCategoryParticipants} disabled={savingParticipants} className="w-full bg-purple-600 text-white font-black py-5 rounded-3xl hover:bg-purple-700 transition disabled:opacity-50 text-lg">
                {savingParticipants ? 'SAVING...' : `Update ${categoryParticipants.length} Restaurants`}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingData && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col relative">
            <div className="sticky top-0 bg-white/90 backdrop-blur p-8 border-b border-gray-100 z-10 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">Edit Details</h2>
                  <p className="text-orange-500 font-bold">{editingData.title}</p>
                </div>
                <button onClick={() => setEditingData(null)} className="text-gray-400 hover:text-red-500 text-3xl font-black bg-gray-100 w-14 h-14 rounded-full flex items-center justify-center">✕</button>
              </div>
            </div>

            <div className="p-10 space-y-16">
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
                           <textarea rows={2} value={editingData.category_collabs?.[cat.name] || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, category_collabs: { ...(prev.category_collabs || {}), [cat.name]: e.target.value }}))} placeholder="Collab content..." className="w-full p-4 border border-purple-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

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
                              <input type="checkbox" checked={(editingData[dbField] || []).includes(opt.name)} onChange={() => toggleEditArray(dbField, opt.name)} className="mr-3 h-5 w-5" />
                              <span className="text-sm font-bold text-gray-700">{opt.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-8">
                 <h3 className="text-xl font-black text-gray-900 border-b pb-2">Basic Info</h3>
                 
                 <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Gallery Images (Multiple)</label>
                    <input type="file" multiple accept="image/*" onChange={handleGalleryUpload} className="text-sm font-bold mb-6 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                    
                    {editingData.image_urls && editingData.image_urls.length > 0 && (
                      <div className="flex flex-wrap gap-4 mt-4">
                        {editingData.image_urls.map((url: string, idx: number) => (
                          <div key={idx} className="relative w-28 h-28 group">
                            <img src={url} className="w-full h-full object-cover rounded-2xl shadow-sm border border-gray-200" />
                            <button onClick={() => removeGalleryImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 shadow-md transition transform hover:scale-110">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Main Cover Photo</label>
                      <img src={editingData.image_url || '/images/default.jpg'} className="w-full h-48 object-cover rounded-3xl mb-4 border shadow-sm" alt="Preview" />
                      <input type="file" onChange={handleImageUpload} className="text-sm font-bold w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
                    </div>
                    
                    <div className="space-y-4 flex flex-col justify-end">
                      <input type="text" value={editingData.title || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, title: e.target.value}))} className="w-full p-4 border rounded-2xl font-black text-lg shadow-sm" placeholder="Shop Title" />
                      <input type="number" value={editingData.restaurant_price || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, restaurant_price: parseInt(e.target.value)}))} className="w-full p-4 border rounded-2xl font-bold shadow-sm" placeholder="Price" />
                      <input type="text" value={editingData.address || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, address: e.target.value}))} className="w-full p-4 border rounded-2xl font-bold shadow-sm" placeholder="Address" />
                      <div className="flex gap-2">
                        <input type="text" disabled value={`Lat: ${editingData.lat || 'None'}`} className="flex-1 p-3 bg-gray-50 border rounded-xl text-xs font-mono text-gray-500" />
                        <input type="text" disabled value={`Lng: ${editingData.lng || 'None'}`} className="flex-1 p-3 bg-gray-50 border rounded-xl text-xs font-mono text-gray-500" />
                      </div>
                    </div>
                 </div>

                 <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Operating Hours</label>
                   <textarea rows={6} value={editingData.operating_hours || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, operating_hours: e.target.value}))} className="w-full p-6 border rounded-[32px] text-lg leading-relaxed shadow-sm font-medium" placeholder="Mon-Fri: 11:00-22:00&#10;Sat-Sun: 10:00-23:00" />
                 </div>

                 <textarea rows={5} value={editingData.description || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, description: e.target.value}))} className="w-full p-6 border rounded-[32px] text-lg leading-relaxed shadow-sm" placeholder="Description..." />
                 <textarea rows={8} value={editingData.full_menu || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, full_menu: e.target.value}))} className="w-full p-6 border rounded-[32px] bg-gray-50 font-medium shadow-inner" placeholder="Menu..." />
              </section>

              <button onClick={() => saveEdits(editingData)} className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-6 rounded-[32px] shadow-2xl hover:shadow-orange-500/20 transition transform hover:-translate-y-1 text-xl">
                SAVE ALL CHANGES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}