import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. Parse the incoming request body
    const { resetId, token, newPin } = await request.json();

    if (!newPin || !resetId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 2. Initialize Supabase Admin client using service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 3. Fetch existing restaurant metadata to maintain existing custom_fields
    const { data: restaurant, error: fetchError } = await supabaseAdmin
      .from('restaurants')
      .select('custom_fields')
      .eq('id', resetId)
      .maybeSingle();

    if (fetchError || !restaurant) {
      console.error('Restaurant record not found:', fetchError);
      return NextResponse.json(
        { error: 'Restaurant record not found' },
        { status: 404 }
      );
    }

    const currentCustomFields = restaurant.custom_fields || {};
    const updatedCustomFields = {
      ...currentCustomFields,
      edit_pin: newPin,
    };

    // 4. Update PIN in the 'restaurants' table
    const { error: updateError } = await supabaseAdmin
      .from('restaurants')
      .update({
        edit_pin: newPin,
        custom_fields: updatedCustomFields,
      })
      .eq('id', resetId);

    if (updateError) {
      // Fallback if 'edit_pin' column does not exist directly in schema
      const { error: fallbackError } = await supabaseAdmin
        .from('restaurants')
        .update({ custom_fields: updatedCustomFields })
        .eq('id', resetId);

      if (fallbackError) {
        console.error('Database update failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to update PIN in database' },
          { status: 400 }
        );
      }
    }

    // 5. Return success response
    return NextResponse.json({ success: true, message: 'PIN successfully reset' });

  } catch (err: any) {
    console.error('Reset API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}