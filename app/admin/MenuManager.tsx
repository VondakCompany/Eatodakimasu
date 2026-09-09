// /app/admin/MenuManager.tsx
'use client';
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from './shared';

export default function MenuManager({
  liveRestaurants = [],
  pendingSubmissions = [],
  fetchAllData
}: any) {
  const [selectedRestId, setSelectedRestId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // The working draft of the menu array
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const allRestaurantsList = [...liveRestaurants, ...pendingSubmissions];

  // Filter the list of restaurants in the sidebar
  const filteredRestaurants = useMemo(() => {
    return allRestaurantsList.filter(rest => {
      if (searchQuery && !rest.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allRestaurantsList, searchQuery]);

  // Load a restaurant's menu into the editor
  const selectRestaurant = (id: string) => {
    setSelectedRestId(id);
    const rest = allRestaurantsList.find(r => r.id === id);
    if (rest) {
      // If they have existing items, load them. Otherwise, start with an empty array.
      setMenuItems(rest.menu_items || []);
    }
  };

  // --- MENU EDITOR FUNCTIONS ---
  const addItem = () => {
    setMenuItems([...menuItems, { name: '', price: '', description: '' }]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: value };
    setMenuItems(updated);
  };

  const removeItem = (index: number) => {
    if (!confirm("Remove this item from the menu?")) return;
    const updated = [...menuItems];
    updated.splice(index, 1);
    setMenuItems(updated);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === menuItems.length - 1) return;
    
    const updated = [...menuItems];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap the elements
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setMenuItems(updated);
  };

  // --- DATABASE SYNC ---
  const saveMenu = async () => {
    if (!selectedRestId) return;
    setIsSaving(true);
    
    try {
      // Clean up empty items before saving
      const cleanedMenu = menuItems.filter(item => item.name.trim() !== '');

      const { error } = await supabase
        .from('restaurants')
        .update({ menu_items: cleanedMenu })
        .eq('id', selectedRestId);

      if (error) throw error;
      
      alert(`✅ Menu saved successfully!`);
      fetchAllData(); // Refresh global admin state
    } catch (err: any) {
      alert("Error saving menu: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRestData = allRestaurantsList.find(r => r.id === selectedRestId);

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[700px] animate-in fade-in">
      
      {/* LEFT COLUMN: Restaurant Selector */}
      <div className="w-full md:w-1/3 border-r border-gray-100 bg-gray-50 flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
            📋 Menu Manager
          </h2>
          <div className="relative">
            <Icons.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurants..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition" 
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredRestaurants.length === 0 ? (
             <div className="text-center py-10 text-gray-400 font-bold text-sm">No restaurants found.</div>
          ) : filteredRestaurants.map(rest => {
            const isSelected = rest.id === selectedRestId;
            const itemCount = rest.menu_items?.length || 0;
            
            return (
              <button 
                key={rest.id} 
                onClick={() => selectRestaurant(rest.id)} 
                className={`w-full text-left p-4 rounded-2xl transition border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}
              >
                <div className={`font-black truncate mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>{rest.title}</div>
                <div className={`text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: The Menu Editor */}
      <div className="flex-1 flex flex-col bg-white relative">
        {!selectedRestId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
               <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Select a Restaurant</h3>
            <p className="text-sm font-medium">Choose a restaurant from the sidebar to start building its menu.</p>
          </div>
        ) : (
          <>
            {/* Action Bar */}
            <div className="sticky top-0 z-20 flex justify-between items-center bg-white/90 backdrop-blur-md px-8 py-5 border-b border-gray-100 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-gray-900 truncate pr-4">{selectedRestData?.title}</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">JA Base Menu</p>
              </div>
              <button onClick={saveMenu} disabled={isSaving} className="bg-blue-600 text-white font-black px-6 py-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap flex items-center gap-2">
                {isSaving ? <Icons.Sync className="w-4 h-4 animate-spin" /> : 'Save Menu'}
              </button>
            </div>

            {/* Menu Builder Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
              <div className="max-w-3xl mx-auto space-y-4">
                
                {menuItems.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-gray-200 rounded-[32px] p-12 text-center">
                    <p className="text-gray-500 font-bold mb-4">This menu is currently empty.</p>
                    <button onClick={addItem} className="bg-gray-900 text-white font-black px-6 py-3 rounded-xl hover:bg-black transition shadow-sm">
                      + Add First Item
                    </button>
                  </div>
                ) : (
                  <>
                    {menuItems.map((item, idx) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm group hover:border-blue-200 transition relative">
                        
                        {/* Controls (Order & Delete) */}
                        <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                           <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 transition">↑</button>
                           <button onClick={() => moveItem(idx, 'down')} disabled={idx === menuItems.length - 1} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 transition">↓</button>
                           <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition ml-2">✕</button>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 mb-4 pr-24">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Item Name (JA)</label>
                            <input 
                              type="text" 
                              value={item.name || ''} 
                              onChange={(e) => updateItem(idx, 'name', e.target.value)}
                              placeholder="e.g. ラーメン" 
                              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" 
                            />
                          </div>
                          <div className="w-full md:w-1/3">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Price</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">¥</span>
                              <input 
                                type="number" 
                                value={item.price || ''} 
                                onChange={(e) => updateItem(idx, 'price', e.target.value)}
                                placeholder="800" 
                                className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" 
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Description (Optional)</label>
                          <textarea 
                            rows={2}
                            value={item.description || ''} 
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            placeholder="Briefly describe the dish..." 
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none" 
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="pt-4 pb-12">
                      <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 font-black rounded-2xl hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition">
                        + Add Another Item
                      </button>
                    </div>
                  </>
                )}

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}