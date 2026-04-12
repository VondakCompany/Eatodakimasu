// src/app/api/remove-user/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });

    // --- SECURITY SAFEGUARD: Protect the Root Admin ---
    const { data: firstAdmin } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (firstAdmin && firstAdmin.id === id) {
      return NextResponse.json(
        { error: 'Security constraint: The original root admin cannot be deleted.' }, 
        { status: 403 }
      );
    }
    // --------------------------------------------------

    // 1. Delete their permissions from your custom table
    await supabaseAdmin.from('user_profiles').delete().eq('id', id);

    // 2. Completely delete their core identity from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}