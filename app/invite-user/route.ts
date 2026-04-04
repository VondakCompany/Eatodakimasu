// app/api/invite-user/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export async function POST(request: Request) {
  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required.' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;
    
    let defaultTabs: string[] = [];
    switch (role) {
      case 'admin': 
        defaultTabs = ['directory', 'pending', 'categories', 'translations', 'ad_studio', 'users']; 
        break;
      case 'ad_manager': 
        defaultTabs = ['ad_studio']; 
        break;
      case 'directory_manager': 
        defaultTabs = ['directory', 'pending']; 
        break;
      case 'event_manager': 
        defaultTabs = ['categories']; 
        break;
      case 'translator': 
        defaultTabs = ['translations']; 
        break;
      case 'editor':
        defaultTabs = ['directory', 'pending', 'categories', 'translations']; 
        break;
      default: 
        defaultTabs = ['directory'];
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert([
        {
          id: userId,
          email: email,
          role: role,
          allowed_tabs: defaultTabs
        }
      ]);

    if (profileError) {
      return NextResponse.json({ error: `User invited, but failed to set permissions: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({ message: 'User invited successfully.' }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}