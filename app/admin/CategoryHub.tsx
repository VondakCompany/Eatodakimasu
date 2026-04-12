// CategoryHub.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from './shared';

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
  const [newFilterType, setNewFilterType] = useState<'cuisine' | 'restriction' | 'payment' | 'area'>('cuisine');

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    const payload: any = { 
      name: newCategoryName.trim(), 
      show_badge: false, 
      is_constant: newCategoryIsConstant 
    };
    
    if (newCategoryStartDate && !newCategoryIsConstant) {
      payload.start_date = new Date(newCategoryStartDate).toISOString();
    }
    if (newCategoryEndDate && !newCategoryIsConstant) {
      payload.end_date = new Date(newCategoryEndDate).toISOString();
    }
    
    const { error } = await supabase.from('custom_categories').insert([payload]);
    
    if (error) {
      console.error("Error creating category:", error);
      alert(`Failed to create event: ${error.message}`);
    } else { 
      setNewCategoryName(''); 
      setNewCategoryStartDate(''); 
      setNewCategoryEndDate('');
      setNewCategoryIsConstant(false); 
      fetchAllData(); 
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (confirm(`Delete event "${name}"?`)) {
      const { error } = await supabase.from('custom_categories').delete().eq('id', id);
      if (error) {
        console.error("Delete Error:", error);
        alert(`Failed to delete event: ${error.message}`);
      } else {
        fetchAllData();
      }
    }
  };

  const addMasterFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    const { error } = await supabase.from('filter_options').insert([{ 
      name: newFilterName.trim(), type: newFilterType, translations: {} 
    }]);
    if (error) {
      console.error("Error adding filter:", error);
      alert(`Failed to add filter: ${error.message}`);
    } else { 
      setNewFilterName(''); 
      fetchAllData(); 
    }
  };

  const deleteMasterFilter = async (id: string) => {
    if (confirm('Permanently delete this filter tag?')) {
      const { error } = await supabase.from('filter_options').delete().eq('id', id);
      if (error) {
        console.error("Delete Error:", error);
        alert(`Failed to delete filter: ${error.message}`);
      } else {
        fetchAllData();
      }
    }
  };

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
          <select value={newFilterType} onChange={(e: any) => setNewFilterType(e.target.value)} className="p-3 border rounded-xl font-bold bg-white">
            <option value="cuisine">Cuisine</option>
            <option value="restriction">Dietary</option>
            <option value="payment">Payment</option>
            <option value="area">Area</option>
          </select>
          <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Tag Name" className="flex-1 p-3 border rounded-xl font-bold" />
          <button type="submit" className="bg-orange-600 text-white font-black px-8 py-3 rounded-xl hover:bg-orange-700 transition">Add Tag</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {['cuisine', 'restriction', 'payment', 'area'].map((type) => (
            <div key={type} className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b-2 border-gray-100 pb-2">{type}s</h3>
              <div className="flex flex-col gap-3">
                {masterFilters.filter((f: any) => f.type === type).map((filter: any) => (
                  <div key={filter.id} className="group flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 transition shadow-sm relative">
                    <input type="text" defaultValue={filter.name} 
                           onBlur={(e) => updateBaseTagName(filter.id, filter.name, e.target.value, filter.type)}
                           className="text-sm font-black text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-orange-300 w-4/5" />
                    <button onClick={() => deleteMasterFilter(filter.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Icons.Close className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}