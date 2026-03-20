'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'waseda2026';

  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'categories'>('directory');
  const [loading, setLoading] = useState(true);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);

  // States for dynamic CMS categories
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [editingData, setEditingData] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (isAuthenticated) fetchAllData();
  }, [isAuthenticated]);

  const fetchAllData = async () => {
    setLoading(true);
    
    // Fetch pending, approved, AND custom categories simultaneously using Promise.all
    const [pending, approved, categories] = await Promise.all([
      supabase.from('restaurants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('custom_categories').select('*').order('created_at', { ascending: true })
    ]);

    if (pending.data) setPendingSubmissions(pending.data);
    if (approved.data) setLiveRestaurants(approved.data);
    if (categories.data) setCustomCategories(categories.data);
    
    if (pending.error) console.error("Pending error:", pending.error);
    if (approved.error) console.error("Approved error:", approved.error);
    if (categories.error) console.error("Categories error:", categories.error);
    
    setLoading(false);
  };

  // --- Category Logic ---
  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    const { error } = await supabase.from('custom_categories').insert([{ name: newCategoryName.trim() }]);
    if (error) alert('Error adding category: ' + error.message);
    else {
      setNewCategoryName('');
      fetchAllData();
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? This will remove it from the CMS options.`)) return;
    await supabase.from('custom_categories').delete().eq('id', id);
    fetchAllData();
  };

  // --- Restaurant Action Logic ---
  const updateStatus = async (id: string, newStatus: string, title: string) => {
    const action = newStatus === 'approved' ? 'publish' : 'unpublish';
    if (!confirm(`Are you sure you want to ${action} "${title}"?`)) return;
    await supabase.from('restaurants').update({ status: newStatus }).eq('id', id);
    fetchAllData();
  };

  const deleteRestaurant = async (id: string, title: string) => {
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
    await supabase.from('restaurants').delete().eq('id', id);
    fetchAllData();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data, error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
    
    if (error) {
      alert('Upload failed: ' + error.message);
    } else if (data) {
      const { data: publicData } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
      setEditingData({ ...editingData, image_url: publicData.publicUrl });
    }
    setUploadingImage(false);
  };

  // Helper to toggle array values in the editor (Cuisine, Restrictions, Custom Categories, etc.)
  const toggleEditArray = (field: string, value: string) => {
    const currentArray = editingData[field] || [];
    if (currentArray.includes(value)) {
      setEditingData({ ...editingData, [field]: currentArray.filter((v: string) => v !== value) });
    } else {
      setEditingData({ ...editingData, [field]: [...currentArray, value] });
    }
  };

  const saveEdits = async () => {
    if (!editingData) return;
    const { error } = await supabase.from('restaurants').update(editingData).eq('id', editingData.id);
    if (!error) {
      alert('Successfully updated!');
      setEditingData(null);
      fetchAllData();
    } else {
      alert('Error updating: ' + error.message);
    }
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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 relative">
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-black">Admin CMS</h1>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">Logout</button>
      </div>

      {/* --- CMS TABS --- */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'directory' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Live Directory ({liveRestaurants.length})
        </button>
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Pending Approvals ({pendingSubmissions.length})
        </button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-md' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
          ⚙️ Manage Categories
        </button>
      </div>

      {loading ? (
         <div className="text-center py-20 animate-pulse text-gray-500 font-bold">Loading Database...</div>
      ) : (
        <>
          {/* --- TAB: MANAGE CATEGORIES --- */}
          {activeTab === 'categories' && (
            <div className="max-w-2xl bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-black mb-2">Dynamic CMS Categories</h2>
              <p className="text-gray-500 text-sm mb-8">Add global tags here (like "Stamp Rally" or "Spring Festival"). They will automatically become checkboxes in the Restaurant Editor and filters on the public site.</p>
              
              <form onSubmit={addCategory} className="flex gap-4 mb-8 border-b border-gray-100 pb-8">
                <input 
                  type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} 
                  placeholder="New Category Name (e.g. 新入生歓迎祭)" 
                  className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-purple-500"
                />
                <button type="submit" className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-700 transition">Add</button>
              </form>

              <div className="space-y-3">
                {customCategories.length === 0 ? (
                  <p className="text-gray-400 italic">No custom categories created yet.</p>
                ) : customCategories.map(cat => (
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
                  {restaurant.image_url && (
                    <img src={restaurant.image_url} alt="Cover" className="w-full h-32 object-cover rounded-xl mb-4 bg-gray-100" />
                  )}
                  <h3 className="text-lg font-black text-gray-900 truncate">{restaurant.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Price: ¥{restaurant.restaurant_price || 'N/A'}</p>
                  
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setEditingData(restaurant)} className="flex-1 bg-blue-50 text-blue-600 text-sm font-bold py-2 rounded-lg hover:bg-blue-100 transition">
                      ✏️ Edit Details
                    </button>
                    {activeTab === 'directory' ? (
                      <button onClick={() => updateStatus(restaurant.id, 'pending', restaurant.title)} className="flex-1 bg-yellow-50 text-yellow-700 text-sm font-bold py-2 rounded-lg hover:bg-yellow-100">Unpublish</button>
                    ) : (
                      <button onClick={() => updateStatus(restaurant.id, 'approved', restaurant.title)} className="flex-1 bg-green-50 text-green-700 text-sm font-bold py-2 rounded-lg hover:bg-green-100">Approve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- MASSIVE COMPREHENSIVE EDIT MODAL --- */}
      {editingData && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative">
            
            {/* Modal Sticky Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur z-10 p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-2xl font-black text-gray-900">Editing: {editingData.title}</h2>
              <button onClick={() => setEditingData(null)} className="text-gray-400 hover:text-red-500 text-2xl font-bold bg-gray-100 hover:bg-red-50 w-10 h-10 rounded-full flex items-center justify-center transition">✕</button>
            </div>
            
            <div className="p-6 md:p-8 space-y-12">

              {/* CMS-Driven Dynamic Categories Section */}
              <section className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                <h3 className="text-lg font-black text-purple-900 mb-4 flex items-center">⚙️ Dynamic CMS Categories</h3>
                {customCategories.length === 0 ? (
                  <p className="text-sm text-purple-700">No custom categories have been created yet. Create them in the "Manage Categories" tab.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {customCategories.map(cat => (
                      <label key={cat.id} className="flex items-center cursor-pointer px-4 py-2 bg-white border border-purple-200 rounded-xl hover:bg-purple-100 transition shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={(editingData.other_options || []).includes(cat.name)} 
                          onChange={() => toggleEditArray('other_options', cat.name)} 
                          className="mr-3 h-5 w-5 accent-purple-600" 
                        />
                        <span className="text-sm font-black text-purple-900">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
              
              {/* 1. PHOTO & BASIC INFO */}
              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">1. Photo & Core Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cover Photo</label>
                    {editingData.image_url ? (
                      <img src={editingData.image_url} alt="Preview" className="w-full h-40 object-cover rounded-xl mb-4 shadow-sm" />
                    ) : (
                      <div className="w-full h-40 bg-gray-200 rounded-xl mb-4 flex items-center justify-center text-gray-400 text-sm font-bold">No Image</div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs w-full" />
                    {uploadingImage && <p className="text-orange-500 text-xs font-bold mt-2 animate-pulse">Uploading...</p>}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Title (Japanese)</label>
                      <input type="text" value={editingData.title || ''} onChange={(e) => setEditingData({...editingData, title: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-500 uppercase mb-1">Title (English Translation)</label>
                      <input type="text" value={editingData.title_en || ''} onChange={(e) => setEditingData({...editingData, title_en: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description (Japanese)</label>
                    <textarea rows={4} value={editingData.description || ''} onChange={(e) => setEditingData({...editingData, description: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-500 uppercase mb-1">Description (English Translation)</label>
                    <textarea rows={4} value={editingData.description_en || ''} onChange={(e) => setEditingData({...editingData, description_en: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </section>

              {/* 2. CATEGORIES & FILTERS (Arrays) */}
              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">2. Search Filters & Tags</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Cuisine (ジャンル)</label>
                    <div className="flex flex-wrap gap-2">
                      {['和食', '洋食', '中華', '韓国料理', 'インド料理', '東南アジア', 'ファストフード', 'カフェ・スイーツ', '寿司', '丼もの'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <input type="checkbox" checked={(editingData.cuisine || []).includes(opt)} onChange={() => toggleEditArray('cuisine', opt)} className="mr-2 accent-orange-600" />
                          <span className="text-sm text-gray-700 font-bold">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Dietary Restrictions (食事制限)</label>
                    <div className="flex flex-wrap gap-2">
                      {['ハラール', 'コーシャ', 'ヴィーガン', 'ベジタリアン', 'グルテンフリー', '乳製品不使用', 'ペスカタリアン'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <input type="checkbox" checked={(editingData.food_restrictions || []).includes(opt)} onChange={() => toggleEditArray('food_restrictions', opt)} className="mr-2 accent-green-600" />
                          <span className="text-sm text-gray-700 font-bold">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Payment Methods (決済方法)</label>
                    <div className="flex flex-wrap gap-2">
                      {['現金', 'クレジットカード', 'デビットカード', 'QRコード決済', '電子マネー', '銀行振込'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <input type="checkbox" checked={(editingData.payment_methods || []).includes(opt)} onChange={() => toggleEditArray('payment_methods', opt)} className="mr-2 accent-blue-600" />
                          <span className="text-sm text-gray-700 font-bold">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. MENUS & TAKEOUT */}
              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">3. Menus & Takeout</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Menu (Japanese)</label>
                    <textarea rows={8} value={editingData.full_menu || ''} onChange={(e) => setEditingData({...editingData, full_menu: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. カレー ... ¥800" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-500 uppercase mb-1">Full Menu (English Translation)</label>
                    <textarea rows={8} value={editingData.full_menu_en || ''} onChange={(e) => setEditingData({...editingData, full_menu_en: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Curry ... ¥800" />
                  </div>
                </div>

                <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100">
                  <label className="flex items-center cursor-pointer mb-4">
                    <input type="checkbox" checked={editingData.takeout_available || false} onChange={(e) => setEditingData({...editingData, takeout_available: e.target.checked})} className="h-6 w-6 accent-orange-600 mr-3" />
                    <span className="text-lg font-black text-gray-900">Takeout Available</span>
                  </label>
                  
                  {editingData.takeout_available && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-orange-200 pt-4 mt-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Takeout Menu (JA)</label>
                        <input type="text" value={editingData.takeout_menu || ''} onChange={(e) => setEditingData({...editingData, takeout_menu: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-blue-500 mb-1">Takeout Menu (EN)</label>
                        <input type="text" value={editingData.takeout_menu_en || ''} onChange={(e) => setEditingData({...editingData, takeout_menu_en: e.target.value})} className="w-full p-2 border border-blue-200 rounded-lg text-sm" />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 4. LOCATION & CONTACT */}
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
                    <input type="text" placeholder="Comma separated (e.g. wasemeshi, Waseda)" value={(editingData.restaurant_area || []).join(', ')} onChange={(e) => setEditingData({...editingData, restaurant_area: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full p-3 border border-gray-200 rounded-xl" />
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

              {/* 5. OPERATIONS & INTERNAL NOTES */}
              <section>
                <h3 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-100 pb-2">5. Operations & Notes</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Budget (Number)</label>
                    <input type="number" value={editingData.restaurant_price || ''} onChange={(e) => setEditingData({...editingData, restaurant_price: parseInt(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Total Seats</label>
                    <input type="text" value={editingData.total_seats || ''} onChange={(e) => setEditingData({...editingData, total_seats: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Avg Stay Time</label>
                    <input type="text" value={editingData.avg_stay_time || ''} onChange={(e) => setEditingData({...editingData, avg_stay_time: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={editingData.atom_currency || false} onChange={(e) => setEditingData({...editingData, atom_currency: e.target.checked})} className="h-5 w-5 accent-orange-600 mr-2" />
                      <span className="text-sm font-bold text-gray-800">Atom Currency</span>
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Discount / Special Offers Details</label>
                  <textarea rows={2} value={editingData.discount_info || ''} onChange={(e) => setEditingData({...editingData, discount_info: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl" />
                </div>
                
                <div className="mt-6">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Admin Notes (Hidden from public)</label>
                  <textarea rows={3} value={editingData.admin_notes || ''} onChange={(e) => setEditingData({...editingData, admin_notes: e.target.value})} className="w-full p-3 border border-gray-200 bg-yellow-50 rounded-xl outline-none" placeholder="Add any private team notes..." />
                </div>
              </section>

            </div>

            {/* Modal Sticky Footer (Save Button) */}
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