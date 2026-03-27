'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];

export default function RegisterRestaurant() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [hoursSource, setHoursSource] = useState('google');
  const [takeout, setTakeout] = useState(false);
  const [photoMethod, setPhotoMethod] = useState('email');
  
  // Events Data State
  const [activeEvents, setActiveEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from('custom_categories').select('*').order('created_at');
      if (data) {
        const today = new Date().toISOString().split('T')[0]; 
        const validEvents = data.filter(e => {
          if (e.is_constant) return true;
          const start = e.start_date ? e.start_date.split('T')[0] : null;
          const end = e.end_date ? e.end_date.split('T')[0] : null;
          if (!start && !end) return true;
          if (start && end) return today >= start && today <= end;
          if (start) return today >= start;
          if (end) return today <= end;
          return true;
        });
        setActiveEvents(validEvents);
      }
    };
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    const formData = new FormData(e.currentTarget);
    
    // ✅ Formats hours into a clean multi-line string instead of JSON
    let finalHours = '';
    if (hoursSource === 'manual') {
      finalHours = DAYS.map(day => {
        const val = formData.get(`hours_${day}`) as string;
        return val ? `${day}: ${val}` : `${day}: 定休/未設定`;
      }).join('\n');
    } else if (hoursSource === 'google') {
      finalHours = 'Googleマップに準ずる';
    } else if (hoursSource === 'website') {
      finalHours = '店舗HPに準ずる';
    }

    const newRestaurant = {
      title: formData.get('title'),
      description: formData.get('description'),
      restaurant_price: formData.get('price') ? parseInt(formData.get('price') as string) : null,
      cuisine: formData.getAll('cuisine'),
      food_restrictions: formData.getAll('restrictions'),
      takeout_available: takeout,
      takeout_menu: formData.get('takeout_menu'),
      total_seats: formData.get('total_seats'),
      avg_stay_time: formData.get('avg_stay_time'),
      status: 'pending',
      contact_name: formData.get('contact_name'),
      contact_email: formData.get('contact_email'),
      contact_phone: formData.get('contact_phone'),
      address: formData.get('address'),
      payment_methods: formData.getAll('payment'),
      website_url: formData.get('website_url'),
      atom_currency: formData.get('atom_currency') === 'yes',
      discount_info: formData.get('discount_details'),
      photo_method: photoMethod,
      admin_notes: formData.get('questions'),
      
      other_options: formData.getAll('other_options'), // ✅ Captures selected events
      hours_source: hoursSource,
      operating_hours: finalHours, // ✅ Saves as clean text
      lat: null,
      lng: null,
    };

    const { error } = await supabase.from('restaurants').insert([newRestaurant]);

    setLoading(false);
    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('情報の送信が完了しました！ご協力誠にありがとうございます。');
      (e.target as HTMLFormElement).reset();
      setHoursSource('google');
      setTakeout(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Introduction */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl p-8 md:p-12 text-white shadow-lg mb-8">
        <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">ワセメシ情報ご提供のお願い</h1>
        <p className="text-orange-50 font-medium leading-relaxed mb-6">
          私たちは早稲田大学国際教養学部の「イートチーム」と申します。<br className="hidden md:block"/>
          「ワセメシ」の魅力をもっと多くの方に知っていただき、地域のお店と学生・観光客をつなぐ多言語対応のレストラン検索サイト「イートダキマス」を作成しています。
        </p>
        <div className="bg-white/20 p-5 rounded-2xl backdrop-blur-sm border border-white/30 text-sm">
          <ul className="space-y-2 font-bold">
            <li>✅ 掲載はすべて無料です</li>
            <li>✅ 頂いた情報を元に、こちらで多言語（英語等）に翻訳して掲載します</li>
            <li>✅ 所要時間は5〜10分程度です</li>
          </ul>
        </div>
      </div>

      {message && (
        <div className={`p-5 mb-8 rounded-2xl font-bold text-center shadow-sm ${message.includes('エラー') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: Basic Info */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-gray-900 mb-6 border-b pb-4">1. 店舗の基本情報</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">店舗名 <span className="text-red-500">*</span> <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">🌐 サイト公開</span></label>
              <input required name="title" type="text" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="例：いねや本館" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ご担当者名 <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">🔒 非公開</span></label>
                <input name="contact_name" type="text" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="例：早稲田 太郎" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">電話番号 <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">🔒 非公開</span></label>
                <input name="contact_phone" type="tel" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="例：03-1234-5678" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">🔒 非公開</span></label>
              <input name="contact_email" type="email" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="例：shop@example.com" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">住所 <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">🌐 サイト公開</span></label>
              <input name="address" type="text" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="例：東京都新宿区西早稲田1-2-3" />
            </div>
          </div>
        </section>

        {/* ✅ NEW SECTION: Events & Campaigns */}
        {activeEvents.length > 0 && (
          <section className="p-8 md:p-10 bg-purple-50 border border-purple-100 rounded-[32px] space-y-6">
            <div className="mb-2">
              <h2 className="text-2xl font-black text-purple-900 mb-2 flex items-center gap-2">
                <span>🎉</span> 参加イベント・キャンペーン
              </h2>
              <p className="text-sm font-medium text-purple-800/80">
                イベントに参加している場合はチェックを入れてください。
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {activeEvents.map(event => (
                <label 
                  key={event.id} 
                  className="flex items-start cursor-pointer p-4 rounded-2xl border border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
                >
                  <div className="flex items-center h-6 mt-1">
                    <input 
                      type="checkbox" 
                      name="other_options"
                      value={event.name}
                      className="w-5 h-5 accent-purple-600 rounded" 
                    />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        event.is_constant ? 'bg-slate-200 text-slate-800' : 'bg-purple-200 text-purple-900'
                      }`}>
                        {event.is_constant ? '📌 常設 / Permanent' : '⏰ 期間限定 / Seasonal'}
                      </span>
                    </div>
                    <span className="font-black text-gray-900 text-lg">{event.name}</span>
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 2: Hours */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-gray-900 mb-6 border-b pb-4">2. 営業時間</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-4">営業時間はどちらを参考にすればよろしいですか？ <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['google', 'website', 'manual'].map((source) => (
                <label key={source} className="cursor-pointer">
                  <input type="radio" name="hours_source" value={source} checked={hoursSource === source} onChange={(e) => setHoursSource(e.target.value)} className="peer sr-only" />
                  <div className="px-4 py-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 text-center font-bold text-gray-600 peer-checked:text-orange-700 transition">
                    {source === 'google' && 'Googleマップと同じ'}
                    {source === 'website' && '店舗HPと同じ'}
                    {source === 'manual' && 'ここで手動で入力する'}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {hoursSource === 'manual' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
              <p className="md:col-span-2 text-sm text-gray-500 mb-2 font-medium">※ 定休日の場合は未記入、営業日は「11:00〜14:00、17:00〜21:00」のようにご記入ください。</p>
              {DAYS.map((day) => (
                <div key={day} className="flex items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <span className="w-24 font-bold text-gray-700">{day}</span>
                  <input type="text" name={`hours_${day}`} className="flex-grow px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="11:00〜20:00" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: Food & Dietary */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-gray-900 mb-6 border-b pb-4">3. お食事とサービス</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">代表的な料理ジャンル (複数可)</label>
              <div className="flex flex-wrap gap-3">
                {['和食', '洋食', '中華', '韓国料理', 'インド料理', '東南アジア', 'ファストフード', 'カフェ・スイーツ', '寿司', '丼もの'].map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="checkbox" name="cuisine" value={c} className="peer sr-only" />
                    <div className="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-orange-600 peer-checked:text-white peer-checked:border-orange-600 text-sm font-bold text-gray-600 transition shadow-sm hover:bg-gray-50">
                      {c}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">食事制限への対応 (複数可)</label>
              <div className="flex flex-wrap gap-3">
                {['ハラール', 'ヴィーガン', 'ベジタリアン', 'グルテンフリー', 'コーシャ', '乳製品不使用', 'ペスカタリアン'].map((r) => (
                  <label key={r} className="cursor-pointer">
                    <input type="checkbox" name="restrictions" value={r} className="peer sr-only" />
                    <div className="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-green-600 peer-checked:text-white peer-checked:border-green-600 text-sm font-bold text-gray-600 transition shadow-sm hover:bg-gray-50">
                      {r}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 mb-2">1名あたりの平均ご利用金額（目安）</label>
            <select name="price" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition cursor-pointer font-bold text-gray-700">
              <option value="500">〜500円</option>
              <option value="1000">〜1,000円</option>
              <option value="1500">〜1,500円</option>
              <option value="2000">〜2,000円</option>
              <option value="3000">〜3,000円</option>
              <option value="5000">3,000円以上</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">店舗紹介・おすすめメニュー</label>
            <textarea name="description" rows={4} className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="お店の雰囲気や、学生に人気なメニューなど自由にご記入ください。"></textarea>
          </div>
        </section>

        {/* SECTION 4: Facilities & Takeout */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-gray-900 mb-6 border-b pb-4">4. 設備・テイクアウト</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">総席数</label>
              <input name="total_seats" type="text" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="例：30席" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">平均滞接時間</label>
              <select name="avg_stay_time" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-700 cursor-pointer">
                <option value="~15分">〜15分</option>
                <option value="15分~30分">15分〜30分</option>
                <option value="30分~1時間">30分〜1時間</option>
                <option value="1時間以上">1時間以上</option>
              </select>
            </div>
          </div>

          <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 mb-6">
            <label className="flex items-center cursor-pointer mb-2">
              <input type="checkbox" checked={takeout} onChange={(e) => setTakeout(e.target.checked)} className="h-6 w-6 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer" />
              <span className="ml-3 font-black text-gray-900 text-lg">テイクアウト（お持ち帰り）を行っている</span>
            </label>
            
            {takeout && (
              <div className="mt-4 pt-4 border-t border-orange-200 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">テイクアウト可能なメニュー</label>
                  <input name="takeout_menu" type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="例：お弁当各種、カレー" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">注文方法 (複数可)</label>
                  <div className="flex gap-4">
                    {['店頭注文', '電話注文', 'オンライン(Uber等)'].map((method) => (
                       <label key={method} className="flex items-center">
                         <input type="checkbox" name="payment" value={method} className="h-5 w-5 text-orange-600 rounded border-gray-300" />
                         <span className="ml-2 text-sm font-bold text-gray-700">{method}</span>
                       </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-bold text-gray-900">地域通貨「アトム通貨」は使えますか？</p>
              <p className="text-xs text-gray-500 mt-1">早稲田・高田馬場エリアのコミュニティ通貨</p>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input type="radio" name="atom_currency" value="yes" className="h-5 w-5 text-orange-600" /> <span className="ml-2 font-bold">はい</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input type="radio" name="atom_currency" value="no" className="h-5 w-5 text-gray-400" defaultChecked /> <span className="ml-2 font-bold">いいえ</span>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 5: Photos & Final Notes */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-gray-900 mb-6 border-b pb-4">5. 写真のご提供方法</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-4">店舗やメニューの写真のご提供方法をお選びください</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'email', label: '後でメールで送る', sub: 'eatodakimasu@gmail.com宛' },
                { id: 'website', label: '店舗HPの写真を使用する', sub: 'HPのリンクを共有してください' },
                { id: 'visit', label: 'スタッフに撮影を依頼する', sub: '後日日程調整のご連絡をします' },
              ].map((opt) => (
                <label key={opt.id} className="cursor-pointer">
                  <input type="radio" name="photo_method" value={opt.id} checked={photoMethod === opt.id} onChange={(e) => setPhotoMethod(e.target.value)} className="peer sr-only" />
                  <div className="p-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 transition">
                    <p className="font-bold text-gray-800 peer-checked:text-orange-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-8">
             <label className="block text-sm font-bold text-gray-700 mb-2">その他ご質問・ご要望</label>
             <textarea name="questions" rows={3} className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none" placeholder="ご不明点があればご自由にご記入ください。"></textarea>
          </div>
        </section>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xl font-black py-5 px-6 rounded-2xl hover:from-orange-700 hover:to-orange-600 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1"
        >
          {loading ? '送信中... (Submitting)' : 'この内容で店舗を登録する'}
        </button>
      </form>
    </div>
  );
}