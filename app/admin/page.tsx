'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'waseda2026';

  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories' | 'translations' | 'ad_studio'>('directory');
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

  // ==========================================
  // --- AD STUDIO STATE (IRONCLAD ENGINE) ----
  // ==========================================
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'design' | 'rules'>('design');
  const [showAssets, setShowAssets] = useState(true); 
  const [canvasZoom, setCanvasZoom] = useState(0.65); 
  const [isDragging, setIsDragging] = useState(false);
  const [isMoving, setIsMoving] = useState(false); 
  const [isSavingAds, setIsSavingAds] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false); 
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mobileIframeRef = useRef<HTMLIFrameElement>(null);
  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const mobileWrapperRef = useRef<HTMLDivElement>(null);
  
  const [iframeBody, setIframeBody] = useState<HTMLElement | null>(null);

  const [desktopScrollY, setDesktopScrollY] = useState(0);
  const [mobileScrollY, setMobileScrollY] = useState(0);

  const [previewUrl, setPreviewUrl] = useState('/'); 
  const [previewContext, setPreviewContext] = useState<'home' | 'service_page' | 'restaurant_template' | 'restaurant_specific'>('home');
  
  const [adCampaigns, setAdCampaigns] = useState<any[]>([]);
  
  const [libraryAssets, setLibraryAssets] = useState([
     'https://picsum.photos/seed/3/400/600',
     'https://picsum.photos/seed/4/400/600',
     'https://picsum.photos/seed/5/400/600',
     'https://picsum.photos/seed/6/400/600'
  ]);

  const editorUrl = previewUrl + (previewUrl.includes('?') ? '&' : '?') + 'ad_editor=true';

  useEffect(() => {
    if (activeTab !== 'ad_studio') return;
    
    const interval = setInterval(() => {
      try {
        const activeIframe = previewMode === 'desktop' ? iframeRef.current : mobileIframeRef.current;
        const iframeWindow = activeIframe?.contentWindow as any;

        if (iframeWindow && iframeWindow.document) {
          const currentPath = iframeWindow.location.pathname;
          if (currentPath && currentPath !== previewUrl && currentPath !== 'blank') {
             setPreviewUrl(currentPath);
             if (currentPath === '/') setPreviewContext('home');
             else if (currentPath === '/register') setPreviewContext('service_page');
             else if (currentPath.startsWith('/restaurant/')) setPreviewContext('restaurant_specific');
             else setPreviewContext('service_page');
          }

          if (!iframeWindow._adStudioScrollAttached) {
             iframeWindow.addEventListener('scroll', () => {
                if (previewMode === 'desktop') setDesktopScrollY(iframeWindow.scrollY);
                else setMobileScrollY(iframeWindow.scrollY);
             });
             iframeWindow._adStudioScrollAttached = true;
          }

          if (!iframeWindow._adStudioClickAttached) {
             iframeWindow.document.addEventListener('click', () => {
                setSelectedAdId(null);
                setIsInspectorOpen(false);
             });
             iframeWindow._adStudioClickAttached = true;
          }
        }
      } catch (e) {}
    }, 400);

    return () => clearInterval(interval);
  }, [activeTab, previewMode, previewUrl]);

  const saveAllAds = async () => {
    setIsSavingAds(true);
    const payload = adCampaigns.map(ad => ({
      id: ad.id,
      image_url: ad.image_url,
      x: ad.x, y: ad.y, w: ad.w, h: ad.h,
      action_url: ad.action_url || '',
      mobile_fallback: ad.mobile_fallback,
      mobile_index: ad.mobile_index,
      target_page: ad.target_page,
      targeting_rules: ad.targeting_rules,
      is_active: true
    }));

    const { error } = await supabase.from('ad_campaigns').upsert(payload);
    setIsSavingAds(false);
    if (error) alert(`Error saving ads: ${error.message}`);
    else alert('✅ All ads saved to database!');
  };

  const deleteAdFromDb = async (id: string) => {
    const { error } = await supabase.from('ad_campaigns').delete().eq('id', id);
    if (error) {
      alert(`Error deleting ad: ${error.message}`);
    } else {
      setAdCampaigns(ads => ads.filter(a => a.id !== id));
      setSelectedAdId(null);
      setIsInspectorOpen(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, type: string, payload: any) => {
    setIsDragging(true);
    e.dataTransfer.setData('type', type);
    e.dataTransfer.setData('payload', payload);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const type = e.dataTransfer.getData('type');
    const payload = e.dataTransfer.getData('payload');

    const canvasId = previewMode === 'desktop' ? 'desktop-canvas-inner' : 'mobile-canvas-inner';
    const innerCanvas = document.getElementById(canvasId);
    if (!innerCanvas) return;

    const rect = innerCanvas.getBoundingClientRect();
    const currentScrollY = previewMode === 'desktop' ? desktopScrollY : mobileScrollY;
    
    const x = (e.clientX - rect.left) / canvasZoom;
    const y = ((e.clientY - rect.top) / canvasZoom) + currentScrollY; 

    if (type === 'asset') {
      let defaultTarget = '*'; 
      if (previewContext === 'home') defaultTarget = '/';
      if (previewContext === 'service_page') defaultTarget = previewUrl; 
      if (previewContext === 'restaurant_template') defaultTarget = '/restaurant/*';
      if (previewContext === 'restaurant_specific') defaultTarget = previewUrl;

      const allowInline = defaultTarget === '*' || defaultTarget === '/';
      const defaultMobileFallback = allowInline ? 'inline' : 'top';

      const newAd = {
        id: crypto.randomUUID(), 
        image_url: payload,
        x: Math.max(0, x - 70), 
        y: Math.max(0, y - 150), 
        w: 140, h: 300, 
        action_url: '', 
        mobile_fallback: defaultMobileFallback,
        mobile_index: 2,
        target_page: defaultTarget,
        targeting_rules: { keywords: '', categories: [], require_open: false, max_distance_km: 5 }
      };
      setAdCampaigns(prev => [...prev, newAd]);
      setSelectedAdId(newAd.id);
      setIsInspectorOpen(true);
    }
  };

  const handleMoveStart = (e: React.MouseEvent, ad: any) => {
    if ((e.target as HTMLElement).dataset.resizeHandle) return; 
    e.stopPropagation(); e.preventDefault();
    setSelectedAdId(ad.id);
    
    const startX = e.screenX; const startY = e.screenY;
    const startPosX = ad.x; const startPosY = ad.y;
    const scale = previewMode === 'mobile' && canvasZoom === 0.65 ? 0.9 : canvasZoom;

    let hasMoved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Movement Threshold: Only activate shield if moved more than 2px
      if (!hasMoved && (Math.abs(moveEvent.screenX - startX) > 2 || Math.abs(moveEvent.screenY - startY) > 2)) {
        setIsMoving(true);
        hasMoved = true;
      }

      const dx = (moveEvent.screenX - startX) / scale;
      const dy = (moveEvent.screenY - startY) / scale;
      setAdCampaigns(ads => ads.map(a => a.id === ad.id ? { ...a, x: startPosX + dx, y: startPosY + dy } : a));
    };

    const onMouseUp = () => { 
      setIsMoving(false); 
      document.removeEventListener('mousemove', onMouseMove); 
      document.removeEventListener('mouseup', onMouseUp); 
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, ad: any, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    setSelectedAdId(ad.id);
    
    const startX = e.screenX; const startY = e.screenY;
    const startW = ad.w; const startH = ad.h;
    const startPosX = ad.x; const startPosY = ad.y;
    const scale = previewMode === 'mobile' && canvasZoom === 0.65 ? 0.9 : canvasZoom;

    let hasMoved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Movement Threshold: Only activate shield if moved more than 2px
      if (!hasMoved && (Math.abs(moveEvent.screenX - startX) > 2 || Math.abs(moveEvent.screenY - startY) > 2)) {
        setIsMoving(true);
        hasMoved = true;
      }

      const dx = (moveEvent.screenX - startX) / scale;
      const dy = (moveEvent.screenY - startY) / scale;
      let newW = startW, newH = startH, newX = startPosX, newY = startPosY;
      if (handle.includes('e')) newW = Math.max(40, startW + dx);
      if (handle.includes('s')) newH = Math.max(40, startH + dy);
      if (handle.includes('w')) { newW = Math.max(40, startW - dx); newX = startPosX + (startW - newW); }
      if (handle.includes('n')) { newH = Math.max(40, startH - dy); newY = startPosY + (startH - newH); }
      setAdCampaigns(ads => ads.map(a => a.id === ad.id ? { ...a, w: newW, h: newH, x: newX, y: newY } : a));
    };

    const onMouseUp = () => { 
      setIsMoving(false); 
      document.removeEventListener('mousemove', onMouseMove); 
      document.removeEventListener('mouseup', onMouseUp); 
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const visibleAds = adCampaigns.filter(ad => {
    if (ad.target_page === '*') return true; 
    if (previewContext === 'home' && ad.target_page === '/') return true;
    if (previewContext === 'service_page' && ad.target_page === previewUrl) return true;
    if (previewContext === 'restaurant_template' && ad.target_page === '/restaurant/*') return true;
    if (previewContext === 'restaurant_specific') return ad.target_page === previewUrl || ad.target_page === '/restaurant/*';
    return false;
  });

  // ==========================================
  // --- ORIGINAL CMS LOGIC (UNTOUCHED) ---
  // ==========================================
  useEffect(() => { editingDataRef.current = editingData; }, [editingData]);
  useEffect(() => { if (isAuthenticated) fetchAllData(); }, [isAuthenticated]);

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
      name: newFilterName.trim(), type: newFilterType, translations: {} 
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
      name: newCategoryName.trim(), show_badge: false, is_constant: newCategoryIsConstant
    };
    if (newCategoryStartDate && !newCategoryIsConstant) payload.start_date = new Date(newCategoryStartDate).toISOString();
    if (newCategoryEndDate && !newCategoryIsConstant) payload.end_date = new Date(newCategoryEndDate).toISOString();

    const { error } = await supabase.from('custom_categories').insert([payload]);
    if (!error) { 
      setNewCategoryName(''); setNewCategoryStartDate(''); setNewCategoryEndDate('');
      setNewCategoryIsConstant(false); fetchAllData(); 
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
        if (lat && lng) { updates.lat = lat; updates.lng = lng; }
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
      
      {/* GLOBAL DRAG OVERLAY */}
      {isMoving && <div className="fixed inset-0 z-[999999] cursor-grabbing" />}

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
        <button onClick={() => setActiveTab('ad_studio')} className={`px-6 py-2.5 rounded-full font-black text-sm transition flex items-center gap-2 ${activeTab === 'ad_studio' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>📢 Ad Studio</button>
      </div>

      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-400 font-black text-xl tracking-widest">CONNECTING TO DATABASE...</div>
      ) : (
        <>
          {activeTab === 'ad_studio' && (
            <div className="flex w-full h-[75vh] min-h-[650px] bg-white border border-gray-200 rounded-[2rem] overflow-hidden shadow-sm animate-in fade-in duration-300 relative">
              
              {/* LEFT PANE: Asset Library */}
              <div className={`transition-all duration-300 ease-in-out border-r border-gray-200 flex flex-col bg-gray-50 z-20 shadow-sm relative ${showAssets ? 'w-[260px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'}`}>
                <div className="w-[260px] h-full flex flex-col">
                  <div className="p-5 border-b border-gray-200 bg-white shrink-0">
                    <h2 className="font-black text-gray-900 text-lg">Assets</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Drag to Canvas</p>
                  </div>
                  
                  <div className="p-5 overflow-y-auto flex-1 space-y-8">
                     <button className="w-full border-2 border-dashed border-indigo-300 bg-indigo-50/50 rounded-2xl p-6 text-center hover:bg-indigo-50 transition cursor-pointer group">
                       <span className="block text-3xl mb-2 group-hover:-translate-y-1 transition-transform">☁️</span>
                       <span className="text-xs font-black text-indigo-600">Upload Image</span>
                     </button>
                     
                     <div>
                       <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Media Grid</h3>
                       <div className="grid grid-cols-2 gap-3">
                         {libraryAssets.map((asset, i) => (
                           <div 
                              key={i} 
                              draggable 
                              onDragStart={(e) => handleDragStart(e, 'asset', asset)}
                              className="w-full h-32 rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing overflow-hidden relative group"
                           >
                             <img src={asset} className="w-full h-full object-cover pointer-events-none" />
                             <button 
                               onClick={(e) => handleDeleteAsset(e, i)}
                               className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-xs font-bold z-10"
                             >✕</button>
                           </div>
                         ))}
                       </div>
                     </div>
                  </div>
                </div>
              </div>

              {/* CENTER PANE: Native Scrollable Canvas */}
              <div 
                className="flex-1 bg-gray-200 overflow-auto relative shadow-inner flex flex-col" 
                onClick={() => { setSelectedAdId(null); setIsInspectorOpen(false); }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                
                {/* Floating Top Controls */}
                <div className="sticky top-6 left-1/2 transform -translate-x-1/2 w-max bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.1)] border border-gray-200 flex items-center gap-2 z-40 mb-10">
                  <button onClick={(e) => { e.stopPropagation(); setShowAssets(!showAssets); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${showAssets ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <span className={`transform transition-transform ${showAssets ? '' : 'rotate-180'}`}>◀</span>
                  </button>
                  <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1 cursor-pointer hover:bg-gray-100 transition">
                    <span className="text-xs font-bold text-gray-400 mr-2">Page:</span>
                    <select 
                      value={previewContext === 'restaurant_template' ? 'template' : (previewContext === 'service_page' && previewUrl !== '/register' ? 'custom' : previewUrl)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '/') {
                          setPreviewUrl('/'); setPreviewContext('home');
                        } else if (val === '/register') {
                          setPreviewUrl('/register'); setPreviewContext('service_page');
                        } else if (val === 'template') {
                          setPreviewUrl(`/restaurant/${liveRestaurants[0]?.id || 'preview'}`); setPreviewContext('restaurant_template');
                        } else if (val === 'custom') {
                          const path = window.prompt("Enter exact path to load (e.g. /about):", "/");
                          if (path) { setPreviewUrl(path); setPreviewContext('service_page'); }
                        } else {
                          setPreviewUrl(val); setPreviewContext('restaurant_specific');
                        }
                      }}
                      className="bg-transparent outline-none text-xs font-bold text-gray-900 w-44 cursor-pointer truncate"
                    >
                      <optgroup label="Main Pages">
                        <option value="/">🏠 Homepage</option>
                        <option value="/register">📝 Register Shop</option>
                      </optgroup>
                      <optgroup label="Templates">
                        <option value="template">🍽️ All Restaurant Pages</option>
                      </optgroup>
                      <optgroup label="Specific Shops">
                        {liveRestaurants.map(r => (
                           <option key={r.id} value={`/restaurant/${r.id}`}>↳ {r.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Other">
                        <option value="custom">🔗 Custom Path...</option>
                      </optgroup>
                    </select>
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  
                  <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1">
                    <button onClick={(e) => { e.stopPropagation(); setCanvasZoom(z => Math.max(0.2, z - 0.1)); }} className="w-7 h-7 flex items-center justify-center font-bold text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-200 transition">-</button>
                    <span className="text-[10px] font-black w-10 text-center text-gray-600">{Math.round(canvasZoom * 100)}%</span>
                    <button onClick={(e) => { e.stopPropagation(); setCanvasZoom(z => Math.min(2.0, z + 0.1)); }} className="w-7 h-7 flex items-center justify-center font-bold text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-200 transition">+</button>
                  </div>
                  
                  <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewMode('desktop'); }} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${previewMode === 'desktop' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>Desktop</button>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewMode('mobile'); }} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${previewMode === 'mobile' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>Mobile</button>
                  
                  <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); saveAllAds(); }} 
                    disabled={isSavingAds}
                    className="px-5 py-2 rounded-full text-xs font-black bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingAds ? '🔄 SAVING...' : '💾 SAVE LAYOUT'}
                  </button>
                </div>

                {/* THE IRONCLAD SCALING WRAPPER */}
                {previewMode === 'desktop' ? (
                  <div className="min-w-max p-20 flex justify-center">
                    <div 
                       id="desktop-canvas-inner"
                       className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-300 relative"
                       style={{ width: 1600, height: 900, transform: `scale(${canvasZoom})`, transformOrigin: 'top center' }}
                       onClick={(e) => e.stopPropagation()} 
                    >
                       <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-[1280px] bg-white border-l border-r border-gray-200 shadow-[0_0_20px_rgba(0,0,0,0.05)]">
                           <iframe 
                             ref={iframeRef}
                             src={editorUrl} 
                             className="w-full h-full border-none bg-gray-50" 
                             style={{ pointerEvents: isDragging || isMoving ? 'none' : 'auto' }} 
                             title="Live Preview"
                           />
                       </div>

                       <div className="absolute top-0 left-0 right-0 h-0 pointer-events-none z-10">
                          {visibleAds.map(ad => (
                             <div 
                               key={ad.id}
                               onMouseDown={(e) => { e.stopPropagation(); handleMoveStart(e, ad); }}
                               onDoubleClick={(e) => { e.stopPropagation(); setIsInspectorOpen(true); }}
                               className={`absolute overflow-visible cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-300 transition-shadow pointer-events-auto ${selectedAdId === ad.id ? 'ring-4 ring-indigo-500 z-50' : 'ring-1 ring-gray-300 z-10 opacity-95'}`}
                               style={{ left: ad.x, top: ad.y - desktopScrollY, width: ad.w, height: ad.h, borderRadius: '1.5rem' }}
                             >
                               <img src={ad.image_url} className="w-full h-full object-cover rounded-[1.5rem] pointer-events-none" />

                               {selectedAdId === ad.id && (
                                 <button 
                                    onMouseDown={(e) => e.stopPropagation()} 
                                    onClick={(e) => { e.stopPropagation(); deleteAdFromDb(ad.id); }} 
                                    className="absolute -top-3 -right-3 bg-red-500 text-white w-7 h-7 rounded-full text-[10px] font-black shadow-lg hover:bg-red-600 transition flex items-center justify-center z-50"
                                 >
                                    ✕
                                 </button>
                               )}

                               {/* PowerPoint Style 8-Point Resize Handles */}
                               {selectedAdId === ad.id && (
                                 <>
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'nw')} className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'n')}  className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-ns-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'ne')} className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'e')}  className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-ew-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'se')} className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 's')}  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-ns-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'sw')} className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize z-10 hover:scale-125 transition-transform" />
                                   <div data-resize-handle onMouseDown={(e) => handleResizeStart(e, ad, 'w')}  className="absolute top-1/2 -translate-y-1/2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-ew-resize z-10 hover:scale-125 transition-transform" />
                                 </>
                               )}
                             </div>
                          ))}
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-max p-10 flex justify-center">
                    <div 
                       id="mobile-canvas-inner"
                       className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.2)] border-[12px] border-gray-900 overflow-hidden flex flex-col relative" 
                       style={{ transform: `scale(${canvasZoom === 0.65 ? 0.9 : canvasZoom})`, transformOrigin: 'top center' }}
                       onClick={(e) => e.stopPropagation()}
                    >
                      <iframe 
                         ref={mobileIframeRef}
                         src={editorUrl} 
                         className="flex-1 w-full border-none bg-gray-50" 
                         style={{ pointerEvents: isDragging || isMoving ? 'none' : 'auto' }}
                         title="Live Mobile Preview"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANE: Behavior Inspector */}
              {isInspectorOpen && selectedAdId && (
                 <div className="w-[20%] min-w-[300px] bg-white border-l border-gray-200 flex flex-col z-50 animate-in slide-in-from-right-8 duration-300 relative">
                   <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                     <div>
                       <h2 className="font-black text-gray-900 text-lg">Inspector</h2>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Edit Ad Logic</p>
                     </div>
                     <button onClick={() => setIsInspectorOpen(false)} className="text-gray-400 hover:text-red-500 font-black bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center border border-gray-200 transition">✕</button>
                   </div>
                   
                   <div className="flex border-b border-gray-200 bg-white shrink-0">
                     <button onClick={() => setInspectorTab('design')} className={`flex-1 py-4 text-xs font-black transition-colors ${inspectorTab === 'design' ? 'border-b-[3px] border-gray-900 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}>Action & Design</button>
                     <button onClick={() => setInspectorTab('rules')} className={`flex-1 py-4 text-xs font-black transition-colors ${inspectorTab === 'rules' ? 'border-b-[3px] border-indigo-600 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>Targeting Rules</button>
                   </div>

                   <div className="p-6 overflow-y-auto flex-1 bg-white">
                      {(() => {
                        const activeAd = adCampaigns.find(a => a.id === selectedAdId);
                        if (!activeAd) return null;

                        const updateAd = (updates: any) => setAdCampaigns(ads => ads.map(a => a.id === selectedAdId ? { ...a, ...updates } : a));
                        const updateRules = (updates: any) => updateAd({ targeting_rules: { ...activeAd.targeting_rules, ...updates } });

                        // Smarter Context Matcher
                        const isGridPage = activeAd.target_page === '/' || activeAd.target_page === '*';

                        if (inspectorTab === 'design') {
                          return (
                            <div className="space-y-6 animate-in fade-in pb-10">
                              <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Destination URL</label>
                                <input type="url" value={activeAd.action_url} onChange={(e) => updateAd({action_url: e.target.value})} placeholder="https://..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" />
                              </div>
                              
                              <div className="pt-4 border-t border-gray-100">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center gap-2">Target Page <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded uppercase">Current</span></label>
                                <select value={activeAd.target_page} onChange={(e) => updateAd({target_page: e.target.value})} className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 shadow-sm cursor-pointer">
                                  <option value="*">🌐 All Pages (Global)</option>
                                  <option value="/">🏠 Homepage Only</option>
                                  <option value="/register">📝 Register Page Only</option>
                                  <option value="/restaurant/*">🍽️ All Restaurant Pages (Template)</option>
                                  
                                  {previewContext === 'service_page' && previewUrl !== '/register' && (
                                     <option value={previewUrl}>📄 {previewUrl} Only</option>
                                  )}
                                  {previewContext === 'restaurant_specific' && (
                                     <option value={previewUrl}>🏪 This Specific Shop Only</option>
                                  )}
                                  {activeAd.target_page.startsWith('/restaurant/') && activeAd.target_page !== '/restaurant/*' && previewUrl !== activeAd.target_page && (
                                     <option value={activeAd.target_page}>🏪 Specific Shop ({activeAd.target_page.split('/').pop()?.slice(0,8)}...)</option>
                                  )}
                                </select>
                              </div>

                              <div className="pt-4 border-t border-gray-100">
                                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">📱 Mobile Behavior</label>
                                <select value={activeAd.mobile_fallback} onChange={(e) => updateAd({mobile_fallback: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 mb-3">
                                  {isGridPage && <option value="inline">Inline Grid Injection</option>}
                                  <option value="sticky">Sticky Bottom Banner</option>
                                </select>
                                
                                {activeAd.mobile_fallback === 'inline' && isGridPage && (
                                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inject After Card #</span>
                                    <input type="number" min="0" value={activeAd.mobile_index || 0} onChange={(e) => updateAd({mobile_index: parseInt(e.target.value) || 0})} className="w-16 p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-center outline-none" />
                                  </div>
                                )}
                              </div>

                              <div className="pt-4 border-t border-gray-100">
                                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">💻 Desktop Layout</label>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Width (px)</label>
                                    <input type="number" value={Math.round(activeAd.w)} onChange={(e) => updateAd({w: parseInt(e.target.value) || 120})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Height (px)</label>
                                    <input type="number" value={Math.round(activeAd.h)} onChange={(e) => updateAd({h: parseInt(e.target.value) || 200})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                  <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">X Pos</label>
                                    <input type="number" value={Math.round(activeAd.x)} onChange={(e) => updateAd({x: parseInt(e.target.value) || 0})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Y Pos</label>
                                    <input type="number" value={Math.round(activeAd.y)} onChange={(e) => updateAd({y: parseInt(e.target.value) || 0})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" />
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => deleteAdFromDb(activeAd.id)} className="w-full mt-6 bg-red-50 text-red-600 font-black py-4 rounded-xl hover:bg-red-100 transition">Delete Ad</button>
                            </div>
                          );
                        } else {
                          return (
                            <div className="space-y-6 animate-in fade-in pb-10">
                              <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Search Intent (query)</label>
                                <input type="text" value={activeAd.targeting_rules.keywords} onChange={(e) => updateRules({keywords: e.target.value})} placeholder="e.g. Sushi, Vegan" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Filter Match (Tags)</label>
                                <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900">
                                  <option value="">Any Category</option>
                                  <option value="Japanese">Japanese</option>
                                  <option value="Vegan">Vegan / Vegetarian</option>
                                  <option value="Halal">Halal</option>
                                </select>
                              </div>
                              <div>
                                 <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                                   <input type="checkbox" checked={activeAd.targeting_rules.require_open} onChange={(e) => updateRules({require_open: e.target.checked})} className="w-4 h-4 accent-indigo-500" />
                                   <span className="text-xs font-bold text-gray-700">Require "Open Now"</span>
                                 </label>
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex justify-between">
                                  <span>Proximity Limit</span>
                                  <span className="text-indigo-600">{activeAd.targeting_rules.max_distance_km} km</span>
                                </label>
                                <input type="range" min="1" max="20" value={activeAd.targeting_rules.max_distance_km} onChange={(e) => updateRules({max_distance_km: parseInt(e.target.value)})} className="w-full accent-indigo-500 cursor-pointer" />
                              </div>
                              <div className="pt-4 border-t border-gray-100">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Schedule</label>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Start</span>
                                    <input type="date" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none text-gray-700" />
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">End</span>
                                    <input type="date" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none text-gray-700" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })()}
                   </div>
                 </div>
              )}
            </div>
          )}

          {/* ... ALL OTHER TABS REMAIN UNTOUCHED ... */}
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