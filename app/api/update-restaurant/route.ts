//app/api/update-restaurant/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, delta, action } = body; 

    // 'action' allows the frontend to explicitly say "Create this anyway" if it's orphaned
    if (!id || !delta) {
      return NextResponse.json({ error: "Missing 'id' or 'delta' payload" }, { status: 400 });
    }

    // --- ORPHAN RECOVERY: If frontend says "force_create", bypass the diff and just insert ---
    if (action === 'force_create') {
      const { error: insertError } = await supabaseAdmin
        .from('restaurants')
        .insert({ id, ...delta });

      if (insertError) throw insertError;

      return NextResponse.json({
        message: "Orphaned update was successfully created as a new restaurant.",
        changes: [{ field: "Creation", oldValue: null, newValue: "Created new record", message: "Restored missing restaurant." }]
      });
    }

    // 1. Fetch current state of the restaurant
    const { data: currentState, error: fetchError } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();

    // --- THE FIX: Handle missing original record ---
    if (fetchError || !currentState) {
      return NextResponse.json({ 
        error: "Original Restaurant Not Found",
        isOrphan: true, // Flag for the frontend UI
        changes: [{ 
          field: "Original Restaurant Not Found", 
          oldValue: null, 
          newValue: delta, 
          message: "The original record was deleted or never existed. You can create it as a new entry." 
        }]
      }, { status: 404 });
    }

    // 2. Generate the diff list inline to replace missing module
    const changesList = Object.keys(delta).map(key => {
      return {
        field: key,
        oldValue: currentState[key] !== undefined ? currentState[key] : null,
        newValue: delta[key],
        message: `Updated ${key}`
      };
    });

    // 3. Exit early if there are no real changes
    if (changesList.length === 0) {
      return NextResponse.json({ message: "No changes detected.", changes: [] });
    }

    // 4. Apply the update to the restaurants table
    const { error: updateError } = await supabaseAdmin
      .from('restaurants')
      .update(delta) 
      .eq('id', id);

    if (updateError) throw updateError;

    // 5. Save the summary to the audit log table
    const { error: auditError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        record_id: id,
        changes: changesList
      });

    if (auditError) {
      console.error("Audit log failed, but restaurant updated:", auditError);
    }

    // 6. Return the clean list of changes
    return NextResponse.json({
      message: "Restaurant updated successfully",
      changes: changesList
    });

  } catch (error) {
    console.error("Update failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}