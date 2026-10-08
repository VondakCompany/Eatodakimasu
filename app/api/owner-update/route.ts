// /app/api/owner-update/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { token, pin, payload } = await request.json();

    if (!token || !pin) {
      return NextResponse.json({ error: "Missing token or PIN" }, { status: 400 });
    }

    const { data: restaurant, error: fetchError } = await supabase
      .from('restaurants')
      .select('id, custom_fields')
      .eq('owner_token', token)
      .single();

    if (fetchError || !restaurant) {
      return NextResponse.json({ error: "Invalid management link." }, { status: 404 });
    }

    const savedPin = restaurant.custom_fields?.edit_pin;
    if (!savedPin || savedPin !== pin) {
      return NextResponse.json({ error: "PINコードが間違っています。(Incorrect PIN)" }, { status: 401 });
    }

    // Include temporary_closures in the update payload
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        temporary_status: payload.temporary_status,
        daily_announcement: payload.daily_announcement,
        menu_items: payload.menu_items,
        temporary_closures: payload.temporary_closures // <-- NEW
      })
      .eq('id', restaurant.id);

    if (updateError) throw updateError;

    return NextResponse.json({ message: "Updated successfully!" });

  } catch (error) {
    console.error("Owner update failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}