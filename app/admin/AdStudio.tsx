// AdStudio.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdStudio({ adCampaigns, setAdCampaigns, liveRestaurants, activeTab }: any) {
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
  
  const [desktopScrollY, setDesktopScrollY] = useState(0);
  const [mobileScrollY, setMobileScrollY] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('/'); 
  const [previewContext, setPreviewContext] = useState<'home' | 'service_page' | 'restaurant_template' | 'restaurant_specific'>('home');
  
  const [libraryAssets] = useState([
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
    const payload = adCampaigns.map((ad: any) => ({
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
      setAdCampaigns((ads: any[]) => ads.filter(a => a.id !== id));
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
      setAdCampaigns((prev: any[]) => [...prev, newAd]);
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
      if (!hasMoved && (Math.abs(moveEvent.screenX - startX) > 2 || Math.abs(moveEvent.screenY - startY) > 2)) {
        setIsMoving(true);
        hasMoved = true;
      }
      const dx = (moveEvent.screenX - startX) / scale;
      const dy = (moveEvent.screenY - startY) / scale;
      setAdCampaigns((ads: any[]) => ads.map(a => a.id === ad.id ? { ...a, x: startPosX + dx, y: startPosY + dy } : a));
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
      setAdCampaigns((ads: any[]) => ads.map(a => a.id === ad.id ? { ...a, w: newW, h: newH, x: newX, y: newY } : a));
    };
    const onMouseUp = () => { 
      setIsMoving(false); 
      document.removeEventListener('mousemove', onMouseMove); 
      document.removeEventListener('mouseup', onMouseUp); 
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const visibleAds = adCampaigns.filter((ad: any) => {
    if (ad.target_page === '*') return true; 
    if (previewContext === 'home' && ad.target_page === '/') return true;
    if (previewContext === 'service_page' && ad.target_page === previewUrl) return true;
    if (previewContext === 'restaurant_template' && ad.target_page === '/restaurant/*') return true;
    if (previewContext === 'restaurant_specific') return ad.target_page === previewUrl || ad.target_page === '/restaurant/*';
    return false;
  });

  return (
    <div className="flex w-full h-[75vh] min-h-[650px] bg-white border border-gray-200 rounded-[2rem] overflow-hidden shadow-sm animate-in fade-in duration-300 relative">
      {isMoving && <div className="fixed inset-0 z-[999999] cursor-grabbing" />}
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
                   <div key={i} draggable onDragStart={(e) => handleDragStart(e, 'asset', asset)} className="w-full h-32 rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing overflow-hidden relative group">
                     <img src={asset} className="w-full h-full object-cover pointer-events-none" />
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-200 overflow-auto relative shadow-inner flex flex-col" onClick={() => { setSelectedAdId(null); setIsInspectorOpen(false); }} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <div className="sticky top-6 left-1/2 transform -translate-x-1/2 w-max bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.1)] border border-gray-200 flex items-center gap-2 z-40 mb-10">
          <button onClick={(e) => { e.stopPropagation(); setShowAssets(!showAssets); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${showAssets ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-gray-500 hover:bg-gray-100'}`}>
            <span className={`transform transition-transform ${showAssets ? '' : 'rotate-180'}`}>◀</span>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
          
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1 cursor-pointer hover:bg-gray-100 transition">
            <span className="text-xs font-bold text-gray-400 mr-2">Page:</span>
            <select value={previewContext === 'restaurant_template' ? 'template' : (previewContext === 'service_page' && previewUrl !== '/register' ? 'custom' : previewUrl)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '/') { setPreviewUrl('/'); setPreviewContext('home'); }
                else if (val === '/register') { setPreviewUrl('/register'); setPreviewContext('service_page'); }
                else if (val === 'template') { setPreviewUrl(`/restaurant/${liveRestaurants[0]?.id || 'preview'}`); setPreviewContext('restaurant_template'); }
                else if (val === 'custom') {
                  const path = window.prompt("Enter exact path to load (e.g. /about):", "/");
                  if (path) { setPreviewUrl(path); setPreviewContext('service_page'); }
                } else { setPreviewUrl(val); setPreviewContext('restaurant_specific'); }
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
                {liveRestaurants.map((r: any) => (
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
          <button onClick={(e) => { e.stopPropagation(); saveAllAds(); }} disabled={isSavingAds} className="px-5 py-2 rounded-full text-xs font-black bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {isSavingAds ? '🔄 SAVING...' : '💾 SAVE LAYOUT'}
          </button>
        </div>
        
        {previewMode === 'desktop' ? (
          <div className="min-w-max p-20 flex justify-center">
            <div id="desktop-canvas-inner" className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-300 relative" style={{ width: 1600, height: 900, transform: `scale(${canvasZoom})`, transformOrigin: 'top center' }} onClick={(e) => e.stopPropagation()} >
               <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-[1280px] bg-white border-l border-r border-gray-200 shadow-[0_0_20px_rgba(0,0,0,0.05)]">
                   <iframe ref={iframeRef} src={editorUrl} className="w-full h-full border-none bg-gray-50" style={{ pointerEvents: isDragging || isMoving ? 'none' : 'auto' }} title="Live Preview" />
               </div>
               <div className="absolute top-0 left-0 right-0 h-0 pointer-events-none z-10">
                  {visibleAds.map((ad: any) => (
                     <div key={ad.id} onMouseDown={(e) => { e.stopPropagation(); handleMoveStart(e, ad); }} onDoubleClick={(e) => { e.stopPropagation(); setIsInspectorOpen(true); }} className={`absolute overflow-visible cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-300 transition-shadow pointer-events-auto ${selectedAdId === ad.id ? 'ring-4 ring-indigo-500 z-50' : 'ring-1 ring-gray-300 z-10 opacity-95'}`} style={{ left: ad.x, top: ad.y - desktopScrollY, width: ad.w, height: ad.h, borderRadius: '1.5rem' }}>
                       <img src={ad.image_url} className="w-full h-full object-cover rounded-[1.5rem] pointer-events-none" />
                       {selectedAdId === ad.id && (
                         <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deleteAdFromDb(ad.id); }} className="absolute -top-3 -right-3 bg-red-500 text-white w-7 h-7 rounded-full text-[10px] font-black shadow-lg hover:bg-red-600 transition flex items-center justify-center z-50">✕</button>
                       )}
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
            <div id="mobile-canvas-inner" className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.2)] border-[12px] border-gray-900 overflow-hidden flex flex-col relative" style={{ transform: `scale(${canvasZoom === 0.65 ? 0.9 : canvasZoom})`, transformOrigin: 'top center' }} onClick={(e) => e.stopPropagation()} >
              <iframe ref={mobileIframeRef} src={editorUrl} className="flex-1 w-full border-none bg-gray-50" style={{ pointerEvents: isDragging || isMoving ? 'none' : 'auto' }} title="Live Mobile Preview" />
            </div>
          </div>
        )}
      </div>
      
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
                const activeAd = adCampaigns.find((a: any) => a.id === selectedAdId);
                if (!activeAd) return null;
                const updateAd = (updates: any) => setAdCampaigns((ads: any[]) => ads.map(a => a.id === selectedAdId ? { ...a, ...updates } : a));
                const updateRules = (updates: any) => updateAd({ targeting_rules: { ...activeAd.targeting_rules, ...updates } });
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
                          {previewContext === 'service_page' && previewUrl !== '/register' && (<option value={previewUrl}>📄 {previewUrl} Only</option>)}
                          {previewContext === 'restaurant_specific' && (<option value={previewUrl}>🏪 This Specific Shop Only</option>)}
                          {activeAd.target_page.startsWith('/restaurant/') && activeAd.target_page !== '/restaurant/*' && previewUrl !== activeAd.target_page && (<option value={activeAd.target_page}>🏪 Specific Shop ({activeAd.target_page.split('/').pop()?.slice(0,8)}...)</option>)}
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
  );
}