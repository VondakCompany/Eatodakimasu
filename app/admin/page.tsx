// page.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { geocodeAddress, getDbField } from './shared';

import Directory from './Directory';
import Pending from './Pending';
import CategoryHub from './CategoryHub';
import Translations from './Translations';
import AdStudio from './AdStudio';
import UserManagement from './UserManagement';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true); // Prevents login screen flash
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'translations' | 'ad_studio' | 'users'>('directory');
  const [loading, setLoading] = useState(true);
  
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [masterFilters, setMasterFilters] = useState<any[]>([]);
  const [appLanguages, setAppLanguages] = useState<any[]>([]);
  const [uiTranslations, setUiTranslations] = useState<any[]>([]);
  const [adCampaigns, setAdCampaigns] = useState<any[]>([]);
  
  const [editingData, setEditingData] = useState<any | null>(null);
  const editingDataRef = useRef<any>(null); 
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [categoryParticipants, setCategoryParticipants] = useState<string[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [batchStatus, setBatchStatus] = useState<{ total: number, current: number, isRunning: boolean } | null>(null);

  useEffect(() => { editingDataRef.current = editingData; }, [editingData]);

  // 1. Check Auth Session on Load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setAuthChecking(false);
    };
    
    checkSession();

    // Listen for auth state changes (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data only if authenticated
  useEffect(() => { 
    if (isAuthenticated) fetchAllData(); 
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });

    if (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchAllData = async () => {
    setLoading(true);
    const [pending, approved, categories, filters, langs, trans, ads] = await Promise.all([
      supabase.from('restaurants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('custom_categories').select('*').order('created_at', { ascending: true }),
      supabase.from('filter_options').select('*').order('name', { ascending: true }),
      supabase.from('app_languages').select('*').order('code', { ascending: true }),
      supabase.from('ui_translations').select('*').order('translation_key', { ascending: true }),
      supabase.from('ad_campaigns').select('*') 
    ]);
    if (pending.data) setPendingSubmissions(pending.data);
    if (approved.data) setLiveRestaurants(approved.data);
    if (categories.data) setCustomCategories(categories.data);
    if (filters.data) setMasterFilters(filters.data);
    if (langs.data) setAppLanguages(langs.data);
    if (trans.data) setUiTranslations(trans.data);
    if (ads.data) setAdCampaigns(ads.data);
    setLoading(false);
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
        if (lat && lng) { updates.lat = lat; updates.lng = lng; }
      }
      await supabase.from('restaurants').update(updates).eq('id', restaurant.id);
      fetchAllData();
    }
  };

  const deleteRestaurant = async (id: string, title: string) => {
    if (confirm(`Delete "${title}"? This cannot be undone.`)) {
      setLiveRestaurants(prev => prev.filter(r => r.id !== id));
      setPendingSubmissions(prev => prev.filter(r => r.id !== id));
      const { error } = await supabase.from('restaurants').delete().eq('id', id);
      if (error) {
        console.error("Delete Error:", error);
        alert(`Failed to delete "${title}" from the database.\nError: ${error.message}`);
        fetchAllData(); 
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fileName = `cover-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;
      const { error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
      if (error) throw error;
      const { data: publicData } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
      setEditingData((prev: any) => {
        if (!prev) return prev;
        return { ...prev, image_url: publicData.publicUrl };
      });
    } catch (error: any) {
      alert(`Cover Image Upload Error:\n${error.message}`);
    } finally {
      setUploadingImage(false); e.target.value = '';
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
        const { error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
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
      setUploadingImage(false); e.target.value = ''; 
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
      if (lat && lng) { updates.lat = lat; updates.lng = lng; }
    }
    
    const { error } = await supabase.from('restaurants').update(updates).eq('id', id);
    setLoading(false);
    if (error) alert(`Database Error:\n${error.message}`);
    else { alert(`✅ Saved Successfully!`); setEditingData(null); fetchAllData(); }
  };

  // Prevent flash of login screen while checking session
  if (authChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-black tracking-widest">VERIFYING ACCESS...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <form onSubmit={handleLogin} className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-200 text-center">
          <h1 className="text-3xl font-black mb-6 text-gray-900">CMS Access</h1>
          
          {loginError && <div className="mb-4 text-xs font-bold text-red-500 bg-red-50 p-3 rounded-lg">{loginError}</div>}
          
          <input 
            type="email" 
            value={emailInput} 
            onChange={(e) => setEmailInput(e.target.value)} 
            placeholder="Admin Email" 
            autoFocus 
            required
            className="w-full px-5 py-4 bg-gray-50 border rounded-xl mb-4 text-center tracking-widest outline-none focus:ring-2 focus:ring-orange-500" 
          />
          <input 
            type="password" 
            value={passwordInput} 
            onChange={(e) => setPasswordInput(e.target.value)} 
            placeholder="Password" 
            required
            className="w-full px-5 py-4 bg-gray-50 border rounded-xl mb-6 text-center tracking-widest outline-none focus:ring-2 focus:ring-orange-500" 
          />
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition">Login</button>
        </form>
      </div>
    );
  }

  const allRestaurantsList = [...liveRestaurants, ...pendingSubmissions];

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
        <button onClick={handleLogout} className="text-sm font-bold text-gray-400 hover:text-red-500 transition">Logout</button>
      </div>
      <div className="flex flex-wrap gap-3 mb-10">
        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'directory' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Directory ({liveRestaurants.length})</button>
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Pending ({pendingSubmissions.length})</button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-lg' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>⚙️ Category Hub</button>
        <button onClick={() => setActiveTab('translations')} className={`px-6 py-2.5 rounded-full font-black text-sm transition ${activeTab === 'translations' ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>🌐 Translations</button>
        <button onClick={() => setActiveTab('ad_studio')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'ad_studio' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>📢 Ad Studio</button>
        <button onClick={() => setActiveTab('users')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>👥 Team</button>
      </div>
      
      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-400 font-black text-xl tracking-widest">CONNECTING TO DATABASE...</div>
      ) : (
        <>
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'ad_studio' && <AdStudio adCampaigns={adCampaigns} setAdCampaigns={setAdCampaigns} liveRestaurants={liveRestaurants} activeTab={activeTab} />}
          {activeTab === 'translations' && <Translations appLanguages={appLanguages} setAppLanguages={setAppLanguages} uiTranslations={uiTranslations} setUiTranslations={setUiTranslations} masterFilters={masterFilters} setMasterFilters={setMasterFilters} liveRestaurants={liveRestaurants} pendingSubmissions={pendingSubmissions} fetchAllData={fetchAllData} updateBaseTagName={updateBaseTagName} />}
          {activeTab === 'categories' && <CategoryHub customCategories={customCategories} setCustomCategories={setCustomCategories} masterFilters={masterFilters} fetchAllData={fetchAllData} openManageCategory={openManageCategory} updateBaseTagName={updateBaseTagName} />}
          {activeTab === 'directory' && <Directory restaurants={liveRestaurants} onEdit={handleEditClick} onStatusUpdate={updateStatus} onDelete={deleteRestaurant} />}
          {activeTab === 'pending' && <Pending restaurants={pendingSubmissions} onEdit={handleEditClick} onStatusUpdate={updateStatus} onDelete={deleteRestaurant} />}
        </>
      )}

      {/* Global Modals Overlays */}
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