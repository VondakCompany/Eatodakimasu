// /components/EditModeal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Icons, getDbField } from '@/app/admin/shared';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: any;
  masterFilters: any[];
  customCategories: any[]; 
  formSchema?: any[]; // Passed in to access dynamically generated blocks
  onSave: (updatedData: any) => Promise<void>;
}

export default function EditModal({ isOpen, onClose, restaurant, masterFilters = [], customCategories = [], formSchema = [], onSave }: EditModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && restaurant) {
      setFormData({ ...restaurant });
    }
  }, [isOpen, restaurant]);

  if (!isOpen || !restaurant) return null;

  const types = Array.from(new Set(masterFilters.map(f => f.type)));

  const handleCheckboxChange = (type: string, name: string, isChecked: boolean) => {
    const fieldName = getDbField(type);
    const currentArray = formData[fieldName] || [];

    if (isChecked) {
      setFormData({ ...formData, [fieldName]: [...currentArray, name] });
    } else {
      setFormData({ ...formData, [fieldName]: currentArray.filter((item: string) => item !== name) });
    }
  };

  const handleCustomFieldChange = (dbColumnRaw: string, name: string, isChecked: boolean) => {
    const jsonKey = dbColumnRaw.replace('custom_fields.', '');
    const currentCustomFields = formData.custom_fields || {};
    const currentArray = Array.isArray(currentCustomFields[jsonKey]) ? currentCustomFields[jsonKey] : [];
    
    if (isChecked) {
        setFormData({ ...formData, custom_fields: { ...currentCustomFields, [jsonKey]: [...currentArray, name] } });
    } else {
        setFormData({ ...formData, custom_fields: { ...currentCustomFields, [jsonKey]: currentArray.filter((item: string) => item !== name) } });
    }
  };

  const handleCategoryChange = (name: string, isChecked: boolean) => {
    const currentArray = formData['other_options'] || [];
    if (isChecked) {
      setFormData({ ...formData, other_options: [...currentArray, name] });
    } else {
      setFormData({ ...formData, other_options: currentArray.filter((item: string) => item !== name) });
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Error saving details.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatHeader = (text: string) => {
    if (!text) return '';
    const formatted = text.replace(/_/g, ' ').toUpperCase();
    return formatted.endsWith('S') ? formatted : `${formatted}S`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-5xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-start p-8 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Edit Details</h2>
            <p className="text-orange-600 font-bold mt-1 text-lg">{restaurant.title}</p>
          </div>
          <button 
            onClick={onClose}
            className="bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 p-3 rounded-full transition-colors"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="mb-8">
            <h3 className="text-xl font-black text-gray-900 border-b border-gray-100 pb-4 mb-6">Filter Tags & Categories</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              
              {/* 1. Dynamic Master Filters */}
              {types.map((type) => {
                const options = masterFilters.filter(f => f.type === type);
                if (options.length === 0) return null;

                const fieldName = getDbField(type);
                const selectedValues = formData[fieldName] || [];

                return (
                  <div key={type} className="flex flex-col">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                      {formatHeader(type)}
                    </h4>
                    <div className="flex flex-col gap-2">
                      {options.map((opt) => (
                        <label 
                          key={opt.id} 
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedValues.includes(opt.name) 
                              ? 'border-orange-200 bg-orange-50/30' 
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(opt.name)}
                            onChange={(e) => handleCheckboxChange(type, opt.name, e.target.checked)}
                            className="w-5 h-5 rounded text-orange-600 accent-orange-600 border-gray-300 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className={`text-sm font-bold ${selectedValues.includes(opt.name) ? 'text-gray-900' : 'text-gray-600'}`}>
                            {opt.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* 2. Dynamically Generated Custom Fields */}
              {formSchema.filter(b => b.dbColumn?.startsWith('custom_fields.') && b.isPublicCustomField !== false).map((block) => (
                  <div key={block.id} className="flex flex-col">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                      {block.label}
                    </h4>
                    <div className="flex flex-col gap-2">
                      {block.options?.map((opt: string) => {
                        const jsonKey = block.dbColumn.replace('custom_fields.', '');
                        const currentArray = formData.custom_fields?.[jsonKey] || [];
                        const isSelected = Array.isArray(currentArray) ? currentArray.includes(opt) : currentArray === opt;

                        return (
                          <label 
                            key={opt} 
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-orange-200 bg-orange-50/30' 
                                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleCustomFieldChange(block.dbColumn, opt, e.target.checked)}
                              className="w-5 h-5 rounded text-orange-600 accent-orange-600 border-gray-300 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className={`text-sm font-bold ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                              {opt}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
              ))}

              {/* 3. Custom Events/Categories */}
              {customCategories.length > 0 && (
                <div className="flex flex-col">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                    EVENTS & OTHERS
                  </h4>
                  <div className="flex flex-col gap-2">
                    {customCategories.map((cat) => {
                      const selectedOptions = formData['other_options'] || [];
                      const isSelected = selectedOptions.includes(cat.name);

                      return (
                        <label 
                          key={cat.id} 
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-orange-200 bg-orange-50/30' 
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleCategoryChange(cat.name, e.target.checked)}
                            className="w-5 h-5 rounded text-orange-600 accent-orange-600 border-gray-300 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                              {cat.name}
                            </span>
                            {cat.is_constant && (
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                Constant
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-[32px] flex justify-end items-center gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-8 py-3 bg-gray-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}