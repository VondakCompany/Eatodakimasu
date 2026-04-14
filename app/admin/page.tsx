'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { geocodeAddress, getDbField, Icons } from './shared';

import Directory from './Directory';
import Pending from './Pending';
import CategoryHub from './CategoryHub';
import Translations from './Translations';
import AdStudio from './AdStudio';
import UserManagement from './UserManagement';
import RegistrationEditor from './RegistrationEditor';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [authChecking, setAuthChecking] = useState(true);
  const [isSlowAuth, setIsSlowAuth] = useState(false);
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'translations' | 'ad_studio' | 'users' | 'registration'>('directory');
  
  const [loading, setLoading] = useState(true);
  const [isSlowData, setIsSlowData] = useState(false);
  
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

  // THIS LOCK PREVENTS THE IFRAME BROADCAST LOOP
  const hasInitializedAuth = useRef(false);

  useEffect(() => { editingDataRef.current = editingData; }, [editingData]);

  // Unified, flicker-free, and broadcast-proof auth initialization
  useEffect(() => {
    let mounted = true;
    let authTimer: NodeJS.Timeout;

    const initAuth = async (session: any) => {
      if (hasInitializedAuth.current) return;

      authTimer = setTimeout(() => {
        if (mounted) setIsSlowAuth(true);
      }, 4000);

      try {
        if (session?.user) {
          const { data, error } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single();
          
          if (error || !data) {
            console.error("Profile missing or RLS blocked. Terminating session.");
            await supabase.auth.signOut();
            if (mounted) setIsAuthenticated(false);
          } else {
            
            // ROOT ADMIN GOD-MODE CHECK
            const { data: rootAdmin } = await supabase.from('user_profiles')
              .select('id')
              .eq('role', 'admin')
              .order('created_at', { ascending: true })
              .limit(1)
              .single();
              
            const isRootAdmin = rootAdmin?.id === session.user.id;

            if (mounted) {
              setUserProfile({ ...data, isRootAdmin }); // Inject true root status into profile
              
              const adminFallback = data.role === 'admin' && (!data.allowed_tabs || data.allowed_tabs.length === 0);
              const hasDir = isRootAdmin || adminFallback || data.allowed_tabs?.includes('directory');
              
              if (!hasDir && data.allowed_tabs?.length > 0) setActiveTab(data.allowed_tabs[0] as any);
              setIsAuthenticated(true);
              hasInitializedAuth.current = true; // Lock engaged
            }
          }
        } else {
          if (mounted) setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Auth init failed:", err);
        if (mounted) setIsAuthenticated(false);
      } finally {
        if (mounted) {
          setAuthChecking(false);
          clearTimeout(authTimer);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && !hasInitializedAuth.current) initAuth(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        if (!hasInitializedAuth.current) {
          setAuthChecking(true);
          initAuth(session);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          hasInitializedAuth.current = false; 
          setIsAuthenticated(false);
          setUserProfile(null);
          setAuthChecking(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => { 
    if (isAuthenticated && userProfile) fetchAllData(); 
  }, [isAuthenticated, userProfile]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthChecking(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });

    if (error) {
      setLoginError(error.message);
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchAllData = () => {
    setLoading(true);
    setIsSlowData(false);
    
    const slowDataTimer = setTimeout(() => setIsSlowData(true), 4000);

    Promise.allSettled([
      supabase.from('restaurants').select('*').eq('status', 'pending').order('created_at', { ascending: false })
        .then(res => { if (res.data) setPendingSubmissions(res.data); }),
        
      supabase.from('restaurants').select('*').eq('status', 'approved').order('created_at', { ascending: false })
        .then(res => { if (res.data) setLiveRestaurants(res.data); }),
        
      supabase.from('custom_categories').select('*').order('created_at', { ascending: true })
        .then(res => { if (res.data) setCustomCategories(res.data); }),
        
      supabase.from('filter_options').select('*').order('name', { ascending: true })
        .then(res => { if (res.data) setMasterFilters(res.data); }),
        
      supabase.from('app_languages').select('*').order('code', { ascending: true })
        .then(res => { if (res.data) setAppLanguages(res.data); }),
        
      supabase.from('ui_translations').select('*').order('translation_key', { ascending: true })
        .then(res => { if (res.data) setUiTranslations(res.data); }),
        
      supabase.from('ad_campaigns').select('*')
        .then(res => { if (res.data) setAdCampaigns(res.data); })
    ]).finally(() => {
      setLoading(false);
      clearTimeout(slowDataTimer);
    });
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

  const hasAccess = (tabId: string) => {
    if (!userProfile) return false;
    
    // GOD MODE: The Root Admin always bypasses array checks to prevent lockouts
    if (userProfile.isRootAdmin) return true;
    
    if (userProfile.role === 'admin' && (!userProfile.allowed_tabs || userProfile.allowed_tabs.length === 0)) return true;
    return userProfile.allowed_tabs?.includes(tabId);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 opacity-0 animate-in fade-in duration-500 delay-200 fill-mode-both">
        <Icons.Sync className="w-10 h-10 animate-spin mb-6 text-gray-300" />
        <div className="font-black tracking-widest text-gray-400 text-lg">VERIFYING ACCESS...</div>
        {isSlowAuth && (
          <div className="mt-6 bg-orange-50 text-orange-600 px-5 py-3 rounded-2xl text-xs font-black border border-orange-100 text-center animate-in fade-in">
            Slow connection detected.<br/>Establishing secure session...
          </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <form onSubmit={handleLogin} className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-200 text-center animate-in fade-in zoom-in-95 duration-500">
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
    <div className="max-w-7xl mx-auto py-8 px-4 relative min-h-screen pb-20 animate-in fade-in duration-500">
      
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin CMS</h1>
          {userProfile && (
            <div className="mt-2 text-sm font-bold text-gray-500 flex items-center gap-2">
              Logged in as <span className="text-gray-900">{userProfile.email}</span>
            </div>
          )}
          {hasAccess('directory') && (
            <button 
              onClick={batchUpdateCoordinates} 
              disabled={batchStatus?.isRunning}
              className="mt-4 text-xs font-black bg-gray-100 text-gray-500 px-4 py-2 rounded-full hover:bg-orange-100 hover:text-orange-600 transition disabled:opacity-50 flex items-center"
            >
              {batchStatus?.isRunning ? (
                <><Icons.Sync className="w-3.5 h-3.5 animate-spin mr-1.5" /> Syncing... ({batchStatus.current}/{batchStatus.total})</>
              ) : (
                <><Icons.MapPin className="w-3.5 h-3.5 mr-1.5" /> Missing Coordinates Sync</>
              )}
            </button>
          )}
        </div>
        <button onClick={handleLogout} className="text-sm font-bold text-gray-400 hover:text-red-500 transition">Logout</button>
      </div>
      
      <div className="flex flex-wrap gap-3 mb-10">
        {hasAccess('directory') && (
          <button onClick={() => setActiveTab('directory')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'directory' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <Icons.Directory className="w-4 h-4" /> Directory ({liveRestaurants.length})
          </button>
        )}
        {hasAccess('pending') && (
          <button onClick={() => setActiveTab('pending')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <Icons.Pending className="w-4 h-4" /> Pending ({pendingSubmissions.length})
          </button>
        )}
        {hasAccess('categories') && (
          <button onClick={() => setActiveTab('categories')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-lg' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
            <Icons.Categories className="w-4 h-4" /> Category Hub
          </button>
        )}
        {hasAccess('translations') && (
          <button onClick={() => setActiveTab('translations')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'translations' ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
            <Icons.Translations className="w-4 h-4" /> Translations
          </button>
        )}
        {hasAccess('ad_studio') && (
          <button onClick={() => setActiveTab('ad_studio')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'ad_studio' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
            <Icons.AdStudio className="w-4 h-4" /> Ad Studio
          </button>
        )}
        {hasAccess('registration') && (
          <button onClick={() => setActiveTab('registration')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'registration' ? 'bg-amber-600 text-white shadow-lg' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
            <Icons.Registration className="w-4 h-4" /> Form Builder
          </button>
        )}
        {hasAccess('users') && (
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
            <Icons.Users className="w-4 h-4" /> Team
          </button>
        )}
      </div>
      
      {loading && liveRestaurants.length === 0 && appLanguages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-gray-100 shadow-sm animate-in fade-in duration-500">
          <Icons.Sync className="w-10 h-10 animate-spin mb-6 text-gray-300" />
          <p className="font-black text-xl text-gray-800 tracking-tight mb-2">Syncing Database</p>
          <p className="text-sm font-bold text-gray-400">Loading your CMS content...</p>
          {isSlowData && (
            <div className="mt-6 bg-orange-50 text-orange-600 px-4 py-2 rounded-full text-xs font-black flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              Slow connection detected. Still pulling data...
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {activeTab === 'users' && hasAccess('users') && <UserManagement />}
          {activeTab === 'ad_studio' && hasAccess('ad_studio') && <AdStudio adCampaigns={adCampaigns} setAdCampaigns={setAdCampaigns} liveRestaurants={liveRestaurants} activeTab={activeTab} />}
          {activeTab === 'translations' && hasAccess('translations') && <Translations appLanguages={appLanguages} setAppLanguages={setAppLanguages} uiTranslations={uiTranslations} setUiTranslations={setUiTranslations} masterFilters={masterFilters} setMasterFilters={setMasterFilters} liveRestaurants={liveRestaurants} pendingSubmissions={pendingSubmissions} fetchAllData={fetchAllData} updateBaseTagName={updateBaseTagName} />}
          {activeTab === 'categories' && hasAccess('categories') && <CategoryHub customCategories={customCategories} setCustomCategories={setCustomCategories} masterFilters={masterFilters} fetchAllData={fetchAllData} openManageCategory={openManageCategory} updateBaseTagName={updateBaseTagName} />}
          {activeTab === 'directory' && hasAccess('directory') && <Directory restaurants={liveRestaurants} onEdit={handleEditClick} onStatusUpdate={updateStatus} onDelete={deleteRestaurant} />}
          {activeTab === 'pending' && hasAccess('pending') && <Pending restaurants={pendingSubmissions} onEdit={handleEditClick} onStatusUpdate={updateStatus} onDelete={deleteRestaurant} />}
          {activeTab === 'registration' && hasAccess('registration') && <RegistrationEditor />}
        </div>
      )}

      {/* Global Modals Overlays */}
      {managingCategory && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-purple-600 p-8 flex justify-between items-center text-white">
              <div>
                <h2 className="text-2xl font-black">Event Participants</h2>
                <p className="text-purple-200 text-sm font-bold">{managingCategory}</p>
              </div>
              <button onClick={() => setManagingCategory(null)} className="text-3xl font-black bg-purple-700 w-12 h-12 rounded-full flex items-center justify-center transition hover:bg-purple-800">
                <Icons.Close className="w-6 h-6 text-white" />
              </button>
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
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col relative animate-in slide-in-from-bottom-8 duration-300">
            <div className="sticky top-0 bg-white/90 backdrop-blur p-8 border-b border-gray-100 z-10 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-gray-900">Edit Details</h2>
                  <p className="text-orange-500 font-bold">{editingData.title}</p>
                </div>
                <button onClick={() => setEditingData(null)} className="text-gray-400 hover:text-red-500 text-3xl font-black bg-gray-100 hover:bg-red-50 w-14 h-14 rounded-full flex items-center justify-center transition">
                  <Icons.Close className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-10 space-y-16">
              <section className="p-8 bg-purple-50 rounded-[32px] border border-purple-100">
                <h3 className="text-xl font-black text-purple-900 mb-6 flex items-center gap-2">
                  <Icons.Categories className="w-6 h-6 text-purple-500" /> Participating Events & Shop Specifics
                </h3>
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

              {/* --- 1. PRIVATE CONTACT INFO & LOGISTICS --- */}
              <section className="space-y-4">
                <h3 className="text-xl font-black text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Icons.Lock className="w-6 h-6 text-red-500" /> Private Admin Data & Logistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="grid grid-cols-1 gap-4 bg-red-50 p-6 rounded-3xl border border-red-100">
                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest">Contact Details</label>
                    <input type="text" value={editingData.contact_name || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, contact_name: e.target.value}))} className="w-full p-4 border border-red-100 rounded-2xl font-bold shadow-sm" placeholder="担当者名 (Contact Name)" />
                    <input type="text" value={editingData.contact_phone || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, contact_phone: e.target.value}))} className="w-full p-4 border border-red-100 rounded-2xl font-bold shadow-sm" placeholder="電話番号 (Phone)" />
                    <input type="text" value={editingData.contact_email || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, contact_email: e.target.value}))} className="w-full p-4 border border-red-100 rounded-2xl font-bold shadow-sm" placeholder="メールアドレス (Email)" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 bg-orange-50 p-6 rounded-3xl border border-orange-100">
                    <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Photo Logistics & Admin Notes</label>
                    <input type="text" value={editingData.photo_method || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, photo_method: e.target.value}))} className="w-full p-4 border border-orange-100 rounded-2xl font-bold shadow-sm" placeholder="写真のご提供方法 (Photo Method)" />
                    <textarea rows={4} value={editingData.admin_notes || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, admin_notes: e.target.value}))} className="w-full p-4 border border-orange-100 rounded-2xl font-medium italic shadow-sm" placeholder="管理者用メモ (Internal Notes)" />
                  </div>
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
                 <h3 className="text-xl font-black text-gray-900 border-b pb-2">Basic Info & Content</h3>
                 <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Gallery Images (Multiple)</label>
                    <input type="file" multiple accept="image/*" onChange={handleGalleryUpload} className="text-sm font-bold mb-6 block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                    {editingData.image_urls && editingData.image_urls.length > 0 && (
                      <div className="flex flex-wrap gap-4 mt-4">
                        {editingData.image_urls.map((url: string, idx: number) => (
                          <div key={idx} className="relative w-28 h-28 group">
                            <img src={url} className="w-full h-full object-cover rounded-2xl shadow-sm border border-gray-200" />
                            <button onClick={() => removeGalleryImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 shadow-md transition transform hover:scale-110">
                              <Icons.Close className="w-4 h-4" />
                            </button>
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
                      <input type="text" value={editingData.website_url || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, website_url: e.target.value}))} className="w-full p-4 border border-blue-100 bg-blue-50/30 rounded-2xl font-bold text-blue-600 shadow-sm" placeholder="Website URL (https://...)" />
                      <input type="number" value={editingData.restaurant_price || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, restaurant_price: parseInt(e.target.value)}))} className="w-full p-4 border rounded-2xl font-bold shadow-sm" placeholder="Price" />
                      <input type="text" value={editingData.address || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, address: e.target.value}))} className="w-full p-4 border rounded-2xl font-bold shadow-sm" placeholder="Address" />
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" value={editingData.total_seats || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, total_seats: e.target.value}))} className="w-full p-4 border rounded-2xl font-bold shadow-sm text-sm" placeholder="総席数 (e.g. 30席)" />
                        <input type="text" value={editingData.avg_stay_time || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, avg_stay_time: e.target.value}))} className="w-full p-4 border rounded-2xl font-bold shadow-sm text-sm" placeholder="平均滞接時間 (e.g. 1時間)" />
                      </div>
                      <div className="flex gap-2">
                        <input type="text" disabled value={`Lat: ${editingData.lat || 'None'}`} className="flex-1 p-3 bg-gray-50 border rounded-xl text-xs font-mono text-gray-500" />
                        <input type="text" disabled value={`Lng: ${editingData.lng || 'None'}`} className="flex-1 p-3 bg-gray-50 border rounded-xl text-xs font-mono text-gray-500" />
                      </div>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Operating Hours</label>
                      <textarea rows={4} value={editingData.operating_hours || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, operating_hours: e.target.value}))} className="w-full p-6 border rounded-[32px] text-lg leading-relaxed shadow-sm font-medium" placeholder="Mon-Fri: 11:00-22:00" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Takeout Menu Details</label>
                      <textarea rows={4} value={editingData.takeout_menu || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, takeout_menu: e.target.value}))} className="w-full p-6 border rounded-[32px] text-sm bg-orange-50/20 font-medium shadow-inner" placeholder="テイクアウトメニュー (Takeout menu info)" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest block mb-2">Discount / Service Info</label>
                    <textarea rows={2} value={editingData.discount_info || ''} onChange={(e) => setEditingData((prev: any) => ({...prev, discount_info: e.target.value}))} className="w-full p-6 border border-orange-100 bg-orange-50/10 rounded-[24px] text-xs font-medium shadow-sm" placeholder="割引・サービス (Discount/Student services)" />
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