// /app/api/verify-pin/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SAFE_UPDATE_COLUMNS = 'id, title, description, address, restaurant_price, total_seats, avg_stay_time, takeout_menu, operating_hours, hours_source, image_url, custom_fields, other_options, menu_items, contact_email';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("CRITICAL: Missing Supabase environment variables.");
      return NextResponse.json({ error: "サーバー設定エラー: 環境変数が不足しています。(Missing ENV)" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { id, pin } = body;

    if (!id || !pin) {
      return NextResponse.json({ error: "店舗IDとPINコードが必要です。(Missing ID or PIN)" }, { status: 400 });
    }

    // 1. Fetch the restaurant securely
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .select(SAFE_UPDATE_COLUMNS)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "店舗が見つかりません。(Restaurant not found)" }, { status: 404 });
    }

    // 2. Safely handle custom fields JSON
    let customFields = data.custom_fields;
    if (typeof customFields === 'string') {
      try { customFields = JSON.parse(customFields); } catch { customFields = {}; }
    }
    customFields = customFields || {};

    // SECURITY FIX 1: Force strict string comparison
    const realPin = customFields.edit_pin ? String(customFields.edit_pin) : undefined;
    
    // SECURITY FIX 2: Removed the '0000' fallback! 
    // If NEXT_PUBLIC_MASTER_PIN is missing from .env, there is NO backdoor.
    const masterPin = process.env.NEXT_PUBLIC_MASTER_PIN; 

    // --- BRUTE FORCE PROTECTION CHECK ---
    const failedAttempts = Number(customFields.failed_attempts || 0);
    const lockedUntil = customFields.locked_until ? new Date(customFields.locked_until) : null;
    const now = new Date();

    if (lockedUntil && now < lockedUntil) {
      const waitMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
      return NextResponse.json({ 
        error: `セキュリティロック中です。${waitMinutes}分後に再度お試しください。(Locked out. Try again in ${waitMinutes}m)` 
      }, { status: 429 });
    }

    // 3. Verify the PIN strictly
    let isCorrect = false;
    if (realPin) {
      isCorrect = (pin === realPin || (!!masterPin && pin === masterPin));
    } else {
      isCorrect = (!!masterPin && pin === masterPin);
    }

    // --- HANDLE FAILURE & SEND MAGIC LINK ---
    if (!isCorrect) {
      const newAttempts = failedAttempts + 1;
      const updates: any = { failed_attempts: newAttempts };
      
      if (newAttempts >= 5) {
        // Lock for 15 mins and generate a reset token
        updates.locked_until = new Date(now.getTime() + 15 * 60000).toISOString();
        
        const resetToken = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
          
        updates.reset_token = resetToken;
        updates.reset_token_expires = new Date(now.getTime() + 60 * 60000).toISOString();

        await supabaseAdmin
          .from('restaurants')
          .update({ custom_fields: { ...customFields, ...updates } })
          .eq('id', id);

        // --- DIAGNOSTIC LOGGING ---
        console.log("⚠️ 5 FAILED ATTEMPTS REACHED. TRIGGERING EMAIL FLOW...");
        
        // Check where the email is actually saved
        const targetEmail = data.contact_email || customFields.contact_email || customFields.email;
        console.log("Target Email Found:", targetEmail || "NONE");
        console.log("Resend API Key Loaded:", !!process.env.RESEND_API_KEY);

        // Send Reset Email via Resend if email exists
        if (targetEmail && process.env.RESEND_API_KEY) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          const resetLink = `${baseUrl}/register?resetId=${id}&token=${resetToken}`;
          
          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Eatodakimasu <noreply@eatodakimasu.com>', 
                to: targetEmail,
                subject: '【Eatodakimasu】店舗情報の編集用PINコード再設定',
                html: `
                  <p>${data.title} 様</p>
                  <p>PINコードの入力が5回連続で失敗したため、セキュリティ保護のためにアカウントを一時ロックしました。</p>
                  <p>以下のリンクより新しいPINコードを設定して、ロックを解除してください。</p>
                  <p><a href="${resetLink}"><strong>新しいPINコードを設定する</strong></a></p>
                  <p>※このリンクは1時間のみ有効です。</p>
                `
              })
            });

            const resJson = await res.json();
            
            if (!res.ok) {
              console.error("❌ RESEND REJECTED THE EMAIL:", resJson);
            } else {
              console.log("✅ RESEND SUCCESS:", resJson);
            }
          } catch (fetchErr) {
            console.error("❌ NETWORK FETCH ERROR:", fetchErr);
          }
        } else {
           console.log("❌ SKIPPING EMAIL: Missing targetEmail or RESEND_API_KEY.");
        }

        return NextResponse.json({ error: "試行回数の上限に達しました。登録メールアドレスにPIN再設定リンクを送信しました。(Account locked. Reset email sent.)" }, { status: 429 });
      } else {
        await supabaseAdmin
          .from('restaurants')
          .update({ custom_fields: { ...customFields, ...updates } })
          .eq('id', id);
          
        const attemptsLeft = 5 - newAttempts;
        return NextResponse.json({ error: `PINコードが間違っています。残り${attemptsLeft}回。(Incorrect PIN. ${attemptsLeft} attempts left)` }, { status: 401 });
      }
    }

    // --- HANDLE SUCCESS (Reset attempts) ---
    if (failedAttempts > 0 || lockedUntil) {
      const cleanCustomFields = { ...customFields };
      delete cleanCustomFields.failed_attempts;
      delete cleanCustomFields.locked_until;
      delete cleanCustomFields.reset_token;
      delete cleanCustomFields.reset_token_expires;
      
      await supabaseAdmin
        .from('restaurants')
        .update({ custom_fields: cleanCustomFields })
        .eq('id', id);
    }

    // Strip the security keys before sending the data to the frontend
    const safeCustomFields = { ...customFields };
    delete safeCustomFields.edit_pin;
    delete safeCustomFields.failed_attempts;
    delete safeCustomFields.locked_until;
    delete safeCustomFields.reset_token;
    delete safeCustomFields.reset_token_expires;

    const safeData = { ...data, custom_fields: safeCustomFields };
    delete safeData.contact_email; 

    return NextResponse.json({ success: true, restaurant: safeData });

  } catch (error) {
    console.error("PIN verification crashed:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました。(Internal Server Error)" }, { status: 500 });
  }
}