import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { claimToken, newPin } = await request.json();

    if (!claimToken || !newPin || newPin.length < 4) {
      return NextResponse.json(
        { error: 'A valid claim token and 4-digit PIN are required.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 1. Locate the restaurant using the claim token
    const { data: restaurant, error: fetchError } = await supabaseAdmin
      .from('restaurants')
      .select('id, title, custom_fields')
      .eq('claim_token', claimToken)
      .maybeSingle();

    if (fetchError || !restaurant) {
      return NextResponse.json(
        { error: 'Invalid or expired claim link.' },
        { status: 404 }
      );
    }

    const updatedCustomFields = {
      ...(restaurant.custom_fields || {}),
      edit_pin: newPin,
    };

    // 2. Set the owner's PIN and nullify claim_token to prevent reuse
    const { error: updateError } = await supabaseAdmin
      .from('restaurants')
      .update({
        edit_pin: newPin,
        custom_fields: updatedCustomFields,
        claim_token: null, // Consumes the token
      })
      .eq('id', restaurant.id);

    if (updateError) {
      console.error('Claim update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to claim restaurant. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      restaurantId: restaurant.id,
      restaurantTitle: restaurant.title,
    });
  } catch (err: any) {
    console.error('Claim API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}