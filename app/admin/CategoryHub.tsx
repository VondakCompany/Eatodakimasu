// /app/admin/CategoryHub.tsx

'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Icons, getDbField } from '@/app/admin/shared';

// Controlled Component to handle local saving state and Enter key submissions
function FilterRow({ filter, updateBaseTagName, deleteMasterFilter }: any) {
  const [val, setVal] = useState(filter.name);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state if the database is updated externally
  useEffect(() => {
    setVal(filter.name);
  }, [filter.name]);

  const handleSave = () => {
    const trimmed = val.trim();
    // Only trigger a database hit if the value actually changed
    if (trimmed && trimmed !== filter.name) {
      setIsSaving(true);
      // Fire and forget so it safely completes even if the user switches tabs
      updateBaseTagName(filter.id, filter.name, trimmed, filter.type).finally(() => {
        setIsSaving(false);
      });
    } else {
      setVal(filter.name); // Revert back if they accidentally deleted all text
    }
  };

  return (
    <div className="group flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 transition shadow-sm relative">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { 
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur(); // This safely triggers the onBlur save above
          }
        }}
        disabled={isSaving}
        className={`text-sm font-black text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-orange-300 w-4/5 transition-opacity ${isSaving ? 'opacity-40 cursor-wait' : 'opacity-100'}`}
      />
      <button 
        onMouseDown={(e) => {
          e.preventDefault();
          deleteMasterFilter(filter.id, filter.name, filter.type);
        }} 
        disabled={isSaving}
        className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition disabled:opacity-0"
      >
        <Icons.Close className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function CategoryHub({ 
  customCategories, 
  setCustomCategories, 
  masterFilters, 
  fetchAllData, 
  openManageCategory,
  updateBaseTagName 
}: any) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryStartDate, setNewCategoryStartDate] = useState('');
  const [newCategoryEndDate, setNewCategoryEndDate] = useState('');
  const [newCategoryIsConstant, setNewCategoryIsConstant] = useState(false);
  
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterType, setNewFilterType] = useState('cuisine');
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState('');

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;
    
    const payload: any = { 
      name: trimmedName, 
      show_badge: false, 
      is_constant: newCategoryIsConstant 
    };
    
    if (newCategoryStartDate && !newCategoryIsConstant) payload.start_date = new Date(newCategoryStartDate).toISOString();
    if (newCategoryEndDate && !newCategoryIsConstant) payload.end_date = new Date(newCategoryEndDate).toISOString();
    
    const { error } = await supabase.from('custom_categories').insert([payload]);
    
    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        alert(`The event "${trimmedName}" already exists!`);
      } else {
        alert(`Failed to create event: ${error.message}`);
      }
    } else { 
      setNewCategoryName(''); 
      setNewCategoryStartDate(''); 
      setNewCategoryEndDate('');
      setNewCategoryIsConstant(false); 
      fetchAllData(); 
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (confirm(`Delete event "${name}"? This will also remove this tag from any participating restaurants.`)) {
      // 1. Delete from categories table
      const { error } = await supabase.from('custom_categories').delete().eq('id', id);
      
      if (error) {
        console.error("Delete Error:", error);
        alert(`Failed to delete event: ${error.message}`);
      } else {
        // 2. Cascade scrub from all restaurants to prevent "ghost" tags
        // Using strict data typing logic to avoid postgREST array crashes on text columns
        const { data: restaurants } = await supabase.from('restaurants').select(`id, other_options`);
        
        if (restaurants && restaurants.length > 0) {
          const updatePromises = restaurants.map(r => {
            const val = r.other_options;
            if (Array.isArray(val) && val.includes(name)) {
              return supabase.from('restaurants').update({ other_options: val.filter(v => v !== name) }).eq('id', r.id);
            }
            return null;
          }).filter(Boolean);

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
          }
        }
        
        fetchAllData();
      }
    }
  };

  const addMasterFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFilterName.trim();
    if (!trimmedName) return;

    const finalType = isCustomType ? customType.trim().toLowerCase().replace(/\s+/g, '_') : newFilterType;
    if (!finalType) {
      return alert("Category name is required.");
    }

    const { error } = await supabase.from('filter_options').insert([{ 
      name: trimmedName, type: finalType, translations: {} 
    }]);
    
    if (error) {
      if (error.code === '23505') {
        alert(`The tag "${trimmedName}" already exists in the database (possibly under a different category). Tag names must be completely unique!`);
      } else {
        alert(`Failed to add tag: ${error.message}`);
      }
    } else { 
      setNewFilterName(''); 
      if (isCustomType) {
        setNewFilterType(finalType);
        setIsCustomType(false);
        setCustomType('');
      }
      fetchAllData(); 
    }
  };

  // TIGHTENED DELETION LOGIC: Properly parses Text vs Array DB columns to prevent 500 errors
  const deleteMasterFilter = async (id: string, name: string, type: string) => {
    if (confirm(`Permanently delete the tag "${name}"? This will also remove it from all restaurants.`)) {
      
      const { error } = await supabase.from('filter_options').delete().eq('id', id);
      
      if (error) {
        console.error("Delete Error:", error);
        alert(`Failed to delete filter: ${error.message}`);
      } else {
        const dbField = getDbField(type);
        
        // Fetch strictly the needed fields to prevent PostgREST Array-operator crashes on Text columns
        const { data: restaurants } = await supabase.from('restaurants').select(`id, ${dbField}`);
        
        if (restaurants && restaurants.length > 0) {
          const updatePromises = restaurants.map(r => {
            const val = r[dbField];
            if (!val) return null;

            // Handle Array columns (like cuisine, food_restrictions)
            if (Array.isArray(val) && val.includes(name)) {
              return supabase.from('restaurants').update({ [dbField]: val.filter(v => v !== name) }).eq('id', r.id);
            } 
            // Handle Text columns (like total_seats, discount_type)
            else if (typeof val === 'string' && val.includes(name)) {
              if (val === name) {
                return supabase.from('restaurants').update({ [dbField]: null }).eq('id', r.id);
              } else {
                const newText = val.split(',').map(s => s.trim()).filter(s => s !== name).join(',');
                return supabase.from('restaurants').update({ [dbField]: newText || null }).eq('id', r.id);
              }
            }
            return null;
          }).filter(Boolean);

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
          }
        }
        
        fetchAllData();
      }
    }
  };

  // TIGHTENED DELETION LOGIC: Properly handles full category wipeout regardless of Column Type
  const deleteMasterFilterCategory = async (type: string) => {
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    if (confirm(`Permanently delete the entire "${typeName}" category? This will wipe all associated tags from every restaurant.`)) {
      
      const tagsToRemove = masterFilters.filter((f: any) => f.type === type).map((f: any) => f.name);
      const dbField = getDbField(type);

      const { error } = await supabase.from('filter_options').delete().eq('type', type);
      
      if (error) {
        console.error("Delete Category Error:", error);
        alert(`Failed to delete category: ${error.message}`);
      } else {
        
        if (tagsToRemove.length > 0) {
          const { data: restaurants } = await supabase.from('restaurants').select(`id, ${dbField}`);
          
          if (restaurants && restaurants.length > 0) {
            const updatePromises = restaurants.map(r => {
              const val = r[dbField];
              if (!val) return null;

              // Array column safe scrub
              if (Array.isArray(val)) {
                const newArray = val.filter(v => !tagsToRemove.includes(v));
                if (newArray.length !== val.length) {
                  return supabase.from('restaurants').update({ [dbField]: newArray }).eq('id', r.id);
                }
              } 
              // Text column safe scrub
              else if (typeof val === 'string') {
                let newText = val;
                let changed = false;
                tagsToRemove.forEach(tag => {
                  if (newText.includes(tag)) {
                    changed = true;
                    if (newText === tag) newText = '';
                    else newText = newText.split(',').map(s => s.trim()).filter(s => s !== tag).join(',');
                  }
                });
                if (changed) {
                  return supabase.from('restaurants').update({ [dbField]: newText || null }).eq('id', r.id);
                }
              }
              return null;
            }).filter(Boolean);

            if (updatePromises.length > 0) {
              await Promise.all(updatePromises);
            }
          }
        }
        
        fetchAllData();
      }
    }
  };

  // Combine standard types with any newly created custom types
  const baseTypes = ['cuisine', 'restriction', 'payment', 'area'];
  const dynamicTypes = Array.from(new Set(masterFilters.map((f: any) => f.type)));
  const allAvailableTypes = Array.from(new Set([...baseTypes, ...dynamicTypes])) as string[];

  return (
    <div className="max-w-6xl space-y-12 pb-20">
      <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
        <h2 className="text-3xl font-black mb-2">Event Management (DMS)</h2>
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
          {customCategories.map((cat: any) => (
            <div key={cat.id} className="bg-gray-50 rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-6 flex justify-between items-center bg-white border-b border-gray-100">
                <span className="font-black text-xl text-gray-900">{cat.name}</span>
                <div className="flex gap-3">
                  <button onClick={() => openManageCategory(cat.name)} className="bg-purple-600 flex items-center gap-1.5 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md"><Icons.Users className="w-4 h-4" /> Participants</button>
                  <button onMouseDown={(e) => { e.preventDefault(); deleteCategory(cat.id, cat.name); }} className="text-red-400 font-bold text-xs px-3 hover:bg-red-50 rounded-lg transition">Delete</button>
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
                          onChange={(e) => setCustomCategories(customCategories.map((c: any) => c.id === cat.id ? {...c, start_date: e.target.value} : c))}
                          onBlur={async (e) => { await supabase.from('custom_categories').update({ start_date: e.target.value ? new Date(e.target.value).toISOString() : null }).eq('id', cat.id); fetchAllData(); }}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none" />
                </div>
                <div className={cat.is_constant ? 'opacity-40 pointer-events-none' : ''}>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Active End Date</label>
                   <input type="date" value={cat.end_date ? cat.end_date.split('T')[0] : ''} 
                          onChange={(e) => setCustomCategories(customCategories.map((c: any) => c.id === cat.id ? {...c, end_date: e.target.value} : c))}
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
                            onChange={(e) => setCustomCategories(customCategories.map((c: any) => c.id === cat.id ? {...c, description: e.target.value} : c))} />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Translated Name (EN)</label>
                    <input type="text" value={cat.translations?.en?.name || ''} className="w-full p-3 border border-blue-100 bg-blue-50/20 rounded-xl text-sm font-bold" 
                           onBlur={async (e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, name: e.target.value } }; await supabase.from('custom_categories').update({ translations: ut }).eq('id', cat.id); fetchAllData(); }} 
                           onChange={(e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, name: e.target.value } }; setCustomCategories(customCategories.map((c: any) => c.id === cat.id ? {...c, translations: ut} : c)); }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Global Rules (EN)</label>
                    <textarea rows={2} value={cat.translations?.en?.description || ''} className="w-full p-4 border border-blue-100 bg-blue-50/20 rounded-2xl text-sm" 
                              onBlur={async (e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; await supabase.from('custom_categories').update({ translations: ut }).eq('id', cat.id); fetchAllData(); }} 
                              onChange={(e) => { const ut = { ...cat.translations, en: { ...cat.translations?.en, description: e.target.value } }; setCustomCategories(customCategories.map((c: any) => c.id === cat.id ? {...c, translations: ut} : c)); }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
        <h2 className="text-3xl font-black mb-2">Master Filter Tags</h2>
        <form onSubmit={addMasterFilter} className="flex flex-wrap gap-4 mb-10 p-6 bg-gray-50 rounded-3xl border border-gray-100">
          
          <div className="flex bg-gray-200 p-1 rounded-xl">
            <button type="button" onClick={() => setIsCustomType(false)} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${!isCustomType ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Existing</button>
            <button type="button" onClick={() => setIsCustomType(true)} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${isCustomType ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>New Category</button>
          </div>

          {!isCustomType ? (
            <select value={newFilterType} onChange={(e: any) => setNewFilterType(e.target.value)} className="p-3 border border-gray-200 rounded-xl font-bold bg-white outline-none">
              {allAvailableTypes.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          ) : (
             <input type="text" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Category (e.g., Music)" className="p-3 border border-gray-200 rounded-xl font-bold bg-white" />
          )}

          <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Tag Name" className="flex-1 p-3 border border-gray-200 rounded-xl font-bold" />
          <button type="submit" className="bg-orange-600 text-white font-black px-8 py-3 rounded-xl hover:bg-orange-700 transition">Add Tag</button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {allAvailableTypes.map((type) => {
            const filtersForType = masterFilters.filter((f: any) => f.type === type);
            if (filtersForType.length === 0 && !baseTypes.includes(type)) return null;

            const isBaseType = baseTypes.includes(type);

            return (
              <div key={type} className="space-y-4 group">
                <div className="flex justify-between items-center border-b-2 border-gray-100 pb-2">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{type}s</h3>
                  {!isBaseType && (
                    <button 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        deleteMasterFilterCategory(type);
                      }}
                      className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                    >
                      Delete Category
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {filtersForType.map((filter: any) => (
                    <FilterRow 
                      key={filter.id} 
                      filter={filter} 
                      updateBaseTagName={updateBaseTagName} 
                      deleteMasterFilter={deleteMasterFilter} 
                    />
                  ))}
                  {filtersForType.length === 0 && <span className="text-xs font-bold text-gray-300">No tags added yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}