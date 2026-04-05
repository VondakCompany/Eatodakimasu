'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日'];

// Same updated BASELINE_SCHEMA as the editor...
const BASELINE_SCHEMA = {
  pageTitle: "ワセメシ情報ご提供のお願い",
  pageDescription: "私たちは早稲田大学国際教養学部の「イートチーム」と申します。\n「ワセメシ」の魅力をもっと多くの方に知っていただき、地域のお店と学生・観光客をつなぐ多言語対応のレストラン検索サイト「イートダキマス」を作成しています。\n\n✅ 掲載はすべて無料です\n✅ 頂いた情報を元に、こちらで多言語（英語等）に翻訳して掲載します\n✅ 所要時間は5〜10分程度です",
  sections: [
    {
      id: "sec_1",
      title: "1. 店舗の基本情報",
      description: "",
      blocks: [
        { id: "b_title", type: "text", label: "店舗名 (🌐 サイト公開)", dbColumn: "title", required: true, placeholder: "例：いねや本館" },
        { id: "b_cname", type: "text", label: "ご担当者名 (🔒 非公開)", dbColumn: "contact_name", required: false, placeholder: "例：早稲田 太郎" },
        { id: "b_cphone", type: "text", label: "電話番号 (🔒 非公開)", dbColumn: "contact_phone", required: false, placeholder: "例：03-1234-5678" },
        { id: "b_cemail", type: "text", label: "メールアドレス (🔒 非公開)", dbColumn: "contact_email", required: false, placeholder: "例：shop@example.com" },
        { id: "b_address", type: "text", label: "住所 (🌐 サイト公開)", dbColumn: "address", required: false, placeholder: "例：東京都新宿区西早稲田1-2-3" }
      ]
    },
    {
      id: "sec_2",
      title: "2. 営業時間",
      description: "",
      blocks: [
        { 
          id: "b_hsource", 
          type: "hours_source", 
          label: "営業時間はどちらを参考にすればよろしいですか？", 
          dbColumn: "hours_source", 
          required: true, 
          options: ["Googleマップと同じ", "店舗HPと同じ", "ここで手動で入力する"],
          conditions: [
            {
              triggerValue: "ここで手動で入力する",
              blocks: [
                { id: "b_hmanual", type: "operating_hours", label: "手動入力の場合", dbColumn: "operating_hours", required: false }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "sec_3",
      title: "3. お食事とサービス",
      description: "",
      blocks: [
        { id: "b_cuisine", type: "checkbox", label: "代表的な料理ジャンル (複数可)", dbColumn: "cuisine", required: false, options: ['和食', '洋食', '中華', '韓国料理', 'インド料理', '東南アジア', 'ファストフード', 'カフェ・スイーツ', '寿司', '丼もの'] },
        { id: "b_restrict", type: "checkbox", label: "食事制限への対応 (複数可)", dbColumn: "food_restrictions", required: false, options: ['ハラール', 'ヴィーガン', 'ベジタリアン', 'グルテンフリー', 'コーシャ', '乳製品不使用', 'ペスカタリアン'] },
        { id: "b_price", type: "select", label: "1名あたりの平均ご利用金額（目安）", dbColumn: "restaurant_price", required: false, options: ["500", "1000", "1500", "2000", "3000", "5000"] },
        { id: "b_desc", type: "textarea", label: "店舗紹介・おすすめメニュー", dbColumn: "description", required: false, placeholder: "お店の雰囲気や、学生に人気なメニューなど自由にご記入ください。" }
      ]
    },
    {
      id: "sec_4",
      title: "4. 設備・テイクアウト",
      description: "",
      blocks: [
        { id: "b_seats", type: "text", label: "総席数", dbColumn: "total_seats", required: false, placeholder: "例：30席" },
        { id: "b_stay", type: "select", label: "平均滞接時間", dbColumn: "avg_stay_time", required: false, options: ["〜15分", "15分〜30分", "30分〜1時間", "1時間以上"] },
        { id: "b_takeout", type: "radio", label: "テイクアウト（お持ち帰り）を行っている", dbColumn: "custom_fields.takeout_available_text", required: false, options: ["はい", "いいえ"] },
        { id: "b_tmenu", type: "text", label: "テイクアウト可能なメニュー", dbColumn: "takeout_menu", required: false, placeholder: "例：お弁当各種、カレー" },
        { id: "b_tmethod", type: "checkbox", label: "注文方法 (複数可)", dbColumn: "payment_methods", required: false, options: ['店頭注文', '電話注文', 'オンライン(Uber等)'] },
        { id: "b_atom", type: "radio", label: "地域通貨「アトム通貨」は使えますか？", dbColumn: "custom_fields.atom_currency_text", required: false, options: ["はい", "いいえ"] }
      ]
    },
    {
      id: "sec_5",
      title: "5. 写真のご提供方法",
      description: "",
      blocks: [
        { id: "b_pmethod", type: "photo_method", label: "店舗やメニューの写真のご提供方法をお選びください", dbColumn: "photo_method", required: true, options: ["後でメールで送る", "店舗HPの写真を使用する", "スタッフに撮影を依頼する"] },
        { id: "b_notes", type: "textarea", label: "その他ご質問・ご要望", dbColumn: "admin_notes", required: false, placeholder: "ご不明点があればご自由にご記入ください。" }
      ]
    }
  ]
};

export default function RegisterRestaurant() {
  const [schema, setSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({ hours_source: 'Googleマップと同じ' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsIframe(window.self !== window.top);

    const fetchData = async () => {
      try {
        const [schemaRes, eventsRes, adsRes] = await Promise.all([
          supabase.from('site_settings').select('data').eq('id', 'registration_schema').maybeSingle(),
          supabase.from('custom_categories').select('*').order('created_at'),
          supabase.from('ad_campaigns').select('*').eq('is_active', true).in('target_page', ['*', '/register'])
        ]);

        if (schemaRes.data?.data?.sections?.length > 0) setSchema(schemaRes.data.data);
        else setSchema(BASELINE_SCHEMA);

        if (eventsRes.data) {
          const today = new Date().toISOString().split('T')[0]; 
          const validEvents = eventsRes.data.filter(e => {
            if (e.is_constant) return true;
            const start = e.start_date ? e.start_date.split('T')[0] : null;
            const end = e.end_date ? e.end_date.split('T')[0] : null;
            if (start && end) return today >= start && today <= end;
            if (start) return today >= start;
            if (end) return today <= end;
            return true;
          });
          setActiveEvents(validEvents);
        }
        if (adsRes.data) setAds(adsRes.data);
      } catch (err: any) {
        setSchema(BASELINE_SCHEMA);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (dbColumn: string, value: any) => {
    setFormData(prev => ({ ...prev, [dbColumn]: value }));
  };

  const handleCheckboxArray = (dbColumn: string, option: string, isChecked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[dbColumn] || [];
      if (isChecked) return { ...prev, [dbColumn]: [...currentArray, option] };
      return { ...prev, [dbColumn]: currentArray.filter((o: string) => o !== option) };
    });
  };

  const handleEventToggle = (eventName: string, isChecked: boolean) => {
    if (isChecked) setSelectedEvents(prev => [...prev, eventName]);
    else setSelectedEvents(prev => prev.filter(e => e !== eventName));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const payload: any = { status: 'pending', custom_fields: {}, other_options: selectedEvents };
    
    Object.keys(formData).forEach(key => {
      if (key.startsWith('hours_') && key !== 'hours_source') return;
      if (key.startsWith('custom_fields.')) {
        payload.custom_fields[key.replace('custom_fields.', '')] = formData[key];
      } else {
        payload[key] = formData[key];
      }
    });

    // Compile hours string based on the answer mapping
    let finalHours = '';
    const hSource = formData['hours_source'];
    if (hSource === 'ここで手動で入力する') {
      finalHours = DAYS.map(day => {
        const val = formData[`hours_${day}`];
        return val ? `${day}: ${val}` : `${day}: 定休/未設定`;
      }).join('\n');
    } else {
      finalHours = hSource || '';
    }
    payload.operating_hours = finalHours;

    const { error } = await supabase.from('restaurants').insert([payload]);

    setLoading(false);
    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('情報の送信が完了しました！ご協力誠にありがとうございます。');
      setFormData({ hours_source: 'Googleマップと同じ' });
      setSelectedEvents([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- RECURSIVE FORM RENDERER ---
  const renderFormBlock = (block: any) => {
    // Check if any conditions match the current form state to render sub-elements
    const activeCondition = block.conditions?.find((c: any) => {
      const val = formData[block.dbColumn];
      if (Array.isArray(val)) return val.includes(c.triggerValue);
      return val === c.triggerValue;
    });

    return (
      <div key={block.id} className="animate-in fade-in duration-300">
        {/* BIG CARDS: HOURS SOURCE */}
        {block.type === 'hours_source' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-4">{block.label} {block.required && <span className="text-red-500">*</span>}</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {block.options?.map((opt: string) => (
                <label key={opt} className="cursor-pointer">
                  <input type="radio" required={block.required && !formData[block.dbColumn]} checked={formData[block.dbColumn] === opt} onChange={() => handleInputChange(block.dbColumn, opt)} className="peer sr-only" />
                  <div className="px-4 py-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 text-center font-bold text-gray-600 peer-checked:text-orange-700 transition">
                    {opt}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 7-DAY GRID: OPERATING HOURS */}
        {block.type === 'operating_hours' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <p className="md:col-span-2 text-sm text-gray-500 mb-2 font-medium">※ 定休日の場合は未記入、営業日は「11:00〜14:00、17:00〜21:00」のようにご記入ください。</p>
            {DAYS.map(day => (
              <div key={day} className="flex items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 transition">
                 <span className="w-24 font-bold text-gray-700">{day}</span>
                 <input type="text" value={formData[`hours_${day}`] || ''} onChange={(e) => handleInputChange(`hours_${day}`, e.target.value)} className="flex-grow px-3 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm font-bold text-gray-800" placeholder="11:00〜20:00" />
              </div>
            ))}
          </div>
        )}

        {/* BIG CARDS: PHOTO METHOD */}
        {block.type === 'photo_method' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-4">{block.label} {block.required && <span className="text-red-500">*</span>}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {block.options?.map((opt: string) => {
                const getSub = (o: string) => o.includes("メール") ? "eatodakimasu@gmail.com宛" : o.includes("HP") ? "HPのリンクを共有してください" : o.includes("スタッフ") ? "後日日程調整のご連絡をします" : "";
                return (
                  <label key={opt} className="cursor-pointer">
                    <input type="radio" required={block.required && !formData[block.dbColumn]} checked={formData[block.dbColumn] === opt} onChange={() => handleInputChange(block.dbColumn, opt)} className="peer sr-only" />
                    <div className="p-4 rounded-xl border-2 border-gray-200 peer-checked:border-orange-500 peer-checked:bg-orange-50 transition">
                      <p className="font-bold text-gray-800 peer-checked:text-orange-900">{opt}</p>
                      <p className="text-xs text-gray-500 mt-1">{getSub(opt)}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* STANDARD RENDERS */}
        {!['hours_source', 'operating_hours', 'photo_method'].includes(block.type) && (
          <div>
            {block.type !== 'html' && (
              <label className="block text-sm font-bold text-gray-700 mb-3">
                {block.label} {block.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}

            {block.type === 'html' && <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: block.content }} />}
            {block.type === 'text' && <input type="text" required={block.required && !formData[block.dbColumn]} placeholder={block.placeholder} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" />}
            {block.type === 'textarea' && <textarea rows={4} required={block.required && !formData[block.dbColumn]} placeholder={block.placeholder} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition" />}
            
            {block.type === 'select' && (
              <select required={block.required && !formData[block.dbColumn]} value={formData[block.dbColumn] || ''} onChange={(e) => handleInputChange(block.dbColumn, e.target.value)} className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer font-bold text-gray-700">
                <option value="">選択してください</option>
                {block.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}

            {(block.type === 'checkbox' || block.type === 'radio') && (
              <div className="flex flex-wrap gap-3">
                {block.options?.map((opt: string) => {
                  const isChecked = block.type === 'checkbox' ? (formData[block.dbColumn] || []).includes(opt) : formData[block.dbColumn] === opt;
                  return (
                    <label key={opt} className="cursor-pointer">
                      <input type={block.type} required={block.required && !formData[block.dbColumn] && block.type === 'radio'} className="peer sr-only" checked={isChecked} onChange={(e) => block.type === 'checkbox' ? handleCheckboxArray(block.dbColumn, opt, e.target.checked) : handleInputChange(block.dbColumn, opt)} />
                      <div className="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-orange-600 peer-checked:text-white peer-checked:border-orange-600 text-sm font-bold text-gray-600 transition shadow-sm hover:bg-gray-50">{opt}</div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* RECURSIVE CONDITIONAL CHILDREN RENDER */}
        {activeCondition && activeCondition.blocks?.length > 0 && (
           <div className="mt-6 ml-4 md:ml-6 pl-4 md:pl-6 border-l-[3px] border-orange-300 space-y-8 relative">
              {activeCondition.blocks.map((childBlock: any) => renderFormBlock(childBlock))}
           </div>
        )}
      </div>
    );
  };

  if (!schema) return <div className="text-center py-20 font-black tracking-widest text-gray-400 animate-pulse">LOADING FORM...</div>;

  return (
    <div className="w-full relative">
      {/* AD STUDIO LAYER */}
      {mounted && !isIframe && createPortal(
        <>
          <div className="hidden lg:block absolute top-0 left-1/2 transform -translate-x-1/2 w-[1600px] h-0 z-40 pointer-events-none">
            {ads.map(ad => (
              <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" className="absolute pointer-events-auto rounded-[1.5rem] overflow-hidden transition hover:opacity-90 bg-gray-50 shadow-lg" style={{ left: ad.x, top: ad.y, width: ad.w, height: ad.h }}>
                <img src={ad.image_url} className="w-full h-full object-cover" alt="Advertisement" />
              </a>
            ))}
          </div>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
            {ads.filter(a => a.mobile_fallback === 'sticky').map(ad => (
              <a key={ad.id} href={ad.action_url || '#'} target="_blank" rel="noopener noreferrer" className="w-full h-20 bg-white flex items-center px-5 gap-4 border-t border-gray-200 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <img src={ad.image_url} className="w-12 h-12 rounded-xl object-cover" alt="Sponsored" />
                <div className="flex flex-col flex-1 truncate">
                  <span className="font-black text-sm text-gray-900">Special Promo</span>
                  <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wide">Sponsored</span>
                </div>
                <span className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-xs font-black">Open</span>
              </a>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* MAIN CONTENT */}
      <div className="max-w-4xl mx-auto py-8 px-4 relative z-10">
        
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl p-8 md:p-12 text-white shadow-lg mb-8">
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">{schema.pageTitle}</h1>
          <p className="text-orange-50 font-medium leading-relaxed whitespace-pre-line">{schema.pageDescription}</p>
        </div>

        {message && (
          <div className={`p-5 mb-8 rounded-2xl font-bold text-center shadow-sm ${message.includes('エラー') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {schema.sections.map((section: any, index: number) => (
            <div key={section.id} className="space-y-8">
              <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 mb-2 border-b pb-4">{index + 1}. {section.title}</h2>
                {section.description && <p className="text-gray-500 text-sm font-medium mb-6 whitespace-pre-line">{section.description}</p>}
                
                <div className="space-y-8 mt-6">
                  {section.blocks.map((block: any) => renderFormBlock(block))}
                </div>
              </section>

              {/* EVENTS INJECTION */}
              {index === 0 && activeEvents.length > 0 && (
                <section className="p-8 md:p-10 bg-purple-50 border border-purple-100 rounded-[32px] space-y-6">
                  <div className="mb-2">
                    <h2 className="text-2xl font-black text-purple-900 mb-2 flex items-center gap-2"><span>🎉</span> 参加イベント・キャンペーン</h2>
                    <p className="text-sm font-medium text-purple-800/80">イベントに参加している場合はチェックを入れてください。</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {activeEvents.map(event => (
                      <label key={event.id} className="flex items-start cursor-pointer p-4 rounded-2xl border border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm">
                        <div className="flex items-center h-6 mt-1">
                          <input type="checkbox" checked={selectedEvents.includes(event.name)} onChange={(e) => handleEventToggle(event.name, e.target.checked)} className="w-5 h-5 accent-purple-600 rounded" />
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${event.is_constant ? 'bg-slate-200 text-slate-800' : 'bg-purple-200 text-purple-900'}`}>
                              {event.is_constant ? '📌 常設 / Permanent' : '⏰ 期間限定 / Seasonal'}
                            </span>
                          </div>
                          <span className="font-black text-gray-900 text-lg">{event.name}</span>
                          {event.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ))}

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xl font-black py-5 px-6 rounded-2xl hover:from-orange-700 hover:to-orange-600 transition shadow-lg hover:shadow-xl disabled:opacity-50 transform hover:-translate-y-1">
            {loading ? '送信中... (Submitting)' : 'この内容で店舗を登録する'}
          </button>
        </form>
      </div>
    </div>
  );
}