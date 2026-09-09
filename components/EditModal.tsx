'use client';

import { useState } from 'react';
import { ChangeLog } from '@/lib/diffGenerator';

// Assume you pass the restaurant ID to this modal
export default function EditModal({ restaurantId }: { restaurantId: string }) {
  const [changesMade, setChangesMade] = useState<ChangeLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Call this function when the user clicks "Save"
  const handleSaveEdits = async (formValues: any) => {
    setIsSaving(true);
    setChangesMade([]); // Reset previous logs
    
    // Example: Only sending the fields the user actually touched
    const deltaUpdate = {
      restaurant_price: formValues.price,
      status: formValues.status,
      admin_notes: formValues.notes
    };

    try {
      const response = await fetch('/api/update-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: restaurantId, delta: deltaUpdate }),
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      // Store the changes so we can show them in a success state
      if (data.changes && data.changes.length > 0) {
        setChangesMade(data.changes);
      }
      
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-container">
      {/* ... Your existing form inputs go here ... */}
      
      <button onClick={() => handleSaveEdits({ price: 1500, status: 'active', notes: 'Updated today' })}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Success View: Show the changelog immediately after saving */}
      {changesMade.length > 0 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="text-green-800 font-bold mb-2">Update Successful!</h4>
          <ul className="text-sm text-green-700 space-y-1">
            {changesMade.map((change, idx) => (
              <li key={idx}>
                <strong>{change.field}:</strong> Changed to {JSON.stringify(change.newValue)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}