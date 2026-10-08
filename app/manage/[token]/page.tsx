// /app/manage/[token]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as JapaneseHolidays from 'japanese-holidays';
import html2canvas from 'html2canvas';

const DAY_HEADERS = ['日', '月', '火', '水', '木', '金', '土'];

const checkIfOpenRightNow = (hoursStr: string) => {
  if (!hoursStr || hoursStr.includes('休業') || hoursStr.includes('休み')) return false;
  const now = new Date();
  const jstStr = now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"});
  const jstDate = new Date(jstStr);
  const currentMinutes = jstDate.getHours() * 60 + jstDate.getMinutes();

  const timeRanges = hoursStr.matchAll(/(\d{1,2}):(\d{2})\s*[-~～]\s*(\d{1,2}):(\d{2})/g);
  let isOpen = false;
  for (const match of Array.from(timeRanges)) {
    const startH = parseInt(match[1], 10);
    const startM = parseInt(match[2], 10);
    let endH = parseInt(match[3], 10);
    const endM = parseInt(match[4], 10);

    const startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    if (endH < startH || endH >= 24) {
      if (endH < startH) endTotal += 24 * 60; 
    }

    let adjustedCurrent = currentMinutes;
    if (currentMinutes < startTotal && endTotal > 24 * 60) {
       adjustedCurrent += 24 * 60;
    }

    if (adjustedCurrent >= startTotal && adjustedCurrent <= endTotal) {
      isOpen = true;
      break;
    }
  }
  return isOpen;
};

const generateRollingSchedule = (parsedHours: any, tempClosures: any[], todayTempStatus: string, days = 365) => {
  const calendar = [];
  const today = new Date();
  const jstStr = today.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  const jstToday = new Date(jstStr);

  for (let i = 0; i < days; i++) {
    const targetDate = new Date(jstToday);
    targetDate.setDate(jstToday.getDate() + i);
    
    const ymd = targetDate.toISOString().split('T')[0];
    const isToday = i === 0;
    
    const isHoliday = JapaneseHolidays.isHoliday(targetDate);
    const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const baseDayKey = isHoliday ? '祝日' : dayNames[targetDate.getDay()];
    
    let hoursText = parsedHours[baseDayKey] || '休業';
    let status = hoursText.includes('休業') || hoursText.includes('休み') ? 'closed' : 'open';
    let overrideReason = null;

    if (isToday && status === 'open') {
      if (!checkIfOpenRightNow(hoursText)) {
        status = 'closed';
      }
    }

    const scheduledClosure = (tempClosures || []).find((c: any) => c.date === ymd);
    if (scheduledClosure) {
      if (scheduledClosure.customHours) {
        status = 'modified';
        hoursText = scheduledClosure.customHours;
        overrideReason = scheduledClosure.reason || '短縮/変更営業';
      } else {
        status = 'temp_closed';
        hoursText = '臨時休業';
        overrideReason = scheduledClosure.reason || '臨時休業';
      }
    }

    if (isToday) {
      if (todayTempStatus === 'sold_out') {
        status = 'sold_out';
        hoursText = '本日終了 (Sold Out)';
      } else if (todayTempStatus === 'temp_closed') {
        status = 'temp_closed';
        hoursText = '臨時休業';
      }
    }

    calendar.push({
      date: targetDate,
      ymd,
      year: targetDate.getFullYear(),
      month: targetDate.getMonth() + 1,
      displayDate: `${targetDate.getMonth() + 1}/${targetDate.getDate()}`,
      dayName: isHoliday ? '祝' : DAY_HEADERS[targetDate.getDay()],
      dayIndex: targetDate.getDay(),
      isHoliday,
      isToday,
      status,
      hoursText,
      overrideReason
    });
  }
  return calendar;
};

export default function OwnerDashboard({ params }: { params: { token: string } }) {
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsedHours, setParsedHours] = useState<any>({});
  
  const [tempStatus, setTempStatus] = useState('normal');
  const [announcement, setAnnouncement] = useState('');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [temporaryClosures, setTemporaryClosures] = useState<any[]>([]);
  
  const [newClosureDate, setNewClosureDate] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');
  const [newClosureHours, setNewClosureHours] = useState('');

  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    const fetchRestaurant = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('title, temporary_status, daily_announcement, menu_items, temporary_closures, operating_hours')
        .eq('owner_token', params.token)
        .single();
        
      if (data) {
        setRestaurant(data);
        setTempStatus(data.temporary_status || 'normal');
        setAnnouncement(data.daily_announcement || '');
        setMenuItems(data.menu_items || []);
        
        let pHours = {};
        try {
          if (typeof data.operating_hours === 'string' && data.operating_hours.trim().startsWith('{')) {
            pHours = JSON.parse(data.operating_hours);
          } else if (typeof data.operating_hours === 'object' && data.operating_hours !== null) {
            pHours = data.operating_hours;
          }
        } catch (e) {}
        setParsedHours(pHours);

        const todayJST = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
        const todayYMD = new Date(todayJST).toISOString().split('T')[0];
        const validClosures = (data.temporary_closures || []).filter((c: any) => c.date >= todayYMD);
        setTemporaryClosures(validClosures);
      }
      setLoading(false);
    };
    fetchRestaurant();
  }, [params.token]);

  const schedule = generateRollingSchedule(parsedHours, temporaryClosures, tempStatus, 365);

  const scheduleByMonth = schedule.reduce((acc: any, day: any) => {
    const monthLabel = `${day.year}年 ${day.month}月`;
    if (!acc[monthLabel]) acc[monthLabel] = [];
    acc[monthLabel].push(day);
    return acc;
  }, {} as Record<string, any[]>);

  const monthKeys = Object.keys(scheduleByMonth);
  const currentMonthLabel = monthKeys[currentMonthIndex];
  const currentMonthDays = scheduleByMonth[currentMonthLabel] || [];

  const toggleMenuItemSoldOut = (index: number) => {
    const newMenu = [...menuItems];
    newMenu[index].isSoldOut = !newMenu[index].isSoldOut;
    setMenuItems(newMenu);
  };

  const addClosure = () => {
    if (!newClosureDate) return;
    const newEntry = { 
      date: newClosureDate, 
      reason: newClosureReason || (newClosureHours ? '短縮営業' : '臨時休業'),
      customHours: newClosureHours 
    };
    const updated = [...temporaryClosures, newEntry].sort((a, b) => a.date.localeCompare(b.date));
    setTemporaryClosures(updated);
    setNewClosureDate('');
    setNewClosureReason('');
    setNewClosureHours('');
  };

  const removeClosure = (index: number) => {
    const updated = temporaryClosures.filter((_, i) => i !== index);
    setTemporaryClosures(updated);
  };

  const handleCalendarClick = (ymd: string) => {
    const existingIndex = temporaryClosures.findIndex(c => c.date === ymd);
    if (existingIndex >= 0) {
      removeClosure(existingIndex);
    } else {
      const newEntry = { 
        date: ymd, 
        reason: newClosureReason || (newClosureHours ? '短縮営業' : '臨時休業'),
        customHours: newClosureHours
      };
      const updated = [...temporaryClosures, newEntry].sort((a, b) => a.date.localeCompare(b.date));
      setTemporaryClosures(updated);
    }
  };

  const downloadCalendarImage = async () => {
    const element = document.getElementById('printable-calendar');
    if (!element) return;
    
    const originalStyle = element.getAttribute('style');
    element.style.width = '800px';
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2, 
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `${restaurant?.title}-Calendar-${currentMonthLabel.replace(' ', '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Failed to generate calendar image", err);
      alert("画像の生成に失敗しました。");
    } finally {
      if (originalStyle) element.setAttribute('style', originalStyle);
      else element.removeAttribute('style');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setPinError('');
    setSuccessMsg('');

    const res = await fetch('/api/owner-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: params.token,
        pin: pin,
        payload: {
          temporary_status: tempStatus,
          daily_announcement: announcement,
          menu_items: menuItems,
          temporary_closures: temporaryClosures
        }
      })
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setPinError(json.error);
    } else {
      setShowPinModal(false);
      setPin('');
      setSuccessMsg('更新されました！ (Updated successfully!)');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-gray-500">Loading...</div>;
  if (!restaurant) return <div className="p-10 text-center font-bold text-red-500">Invalid Management Link</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32 animate-in fade-in">
      <div className="bg-gray-900 text-white p-6 pt-12 shadow-md rounded-b-[32px]">
        <h2 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-1">Owner Dashboard</h2>
        <h1 className="text-2xl font-black">{restaurant.title}</h1>
      </div>

      <div className="max-w-md md:max-w-3xl mx-auto p-4 space-y-6 mt-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
            <h3 className="font-black text-gray-900 mb-4">本日の営業状況 (Live Status)</h3>
            <div className="flex flex-col gap-3">
              <button 
                type="button"
                onClick={() => setTempStatus('normal')} 
                className={`p-4 rounded-xl font-bold border-2 transition ${tempStatus === 'normal' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
              >
                🟢 通常営業 (Normal)
              </button>
              <button 
                type="button"
                onClick={() => setTempStatus('sold_out')} 
                className={`p-4 rounded-xl font-bold border-2 transition ${tempStatus === 'sold_out' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
              >
                🟠 本日終了 / 完売 (Sold Out)
              </button>
              <button 
                type="button"
                onClick={() => setTempStatus('temp_closed')} 
                className={`p-4 rounded-xl font-bold border-2 transition ${tempStatus === 'temp_closed' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
              >
                🔴 臨時休業 (Temp Closed)
              </button>
            </div>
          </section>

          <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-black text-gray-900">本日のメッセージ (Announcement)</h3>
              {announcement && (
                <button 
                  type="button"
                  onClick={() => setAnnouncement('')}
                  className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition"
                >
                  🗑️ クリア (Clear)
                </button>
              )}
            </div>
            <textarea 
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="例: 本日はランチ営業のみとなります。"
              className="w-full h-[150px] p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-none"
            />
          </section>
        </div>

        <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <h3 className="font-black text-gray-900 mb-1">事前 休業日・短縮営業の設定 (Schedule Overrides)</h3>
          <p className="text-xs text-gray-500 mb-4 font-bold">未来の臨時休業や、営業時間の変更を登録できます。</p>
          
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">日付 (Date)</label>
              <input 
                type="date" 
                value={newClosureDate}
                onChange={(e) => setNewClosureDate(e.target.value)}
                className="w-full p-3 bg-white border border-gray-300 rounded-xl outline-none font-bold text-gray-800 text-sm"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1 flex justify-between">
                <span>短縮/変更時間</span>
                <span className="text-gray-400 font-bold">(任意)</span>
              </label>
              <input 
                type="text" 
                placeholder="例: 11:00-14:00"
                value={newClosureHours}
                onChange={(e) => setNewClosureHours(e.target.value)}
                className="w-full p-3 bg-white border border-blue-200 focus:border-blue-400 rounded-xl outline-none text-sm font-bold text-blue-800 placeholder:font-normal"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">理由 (Reason)</label>
              <input 
                type="text" 
                placeholder="例: 貸切のため / 設備点検"
                value={newClosureReason}
                onChange={(e) => setNewClosureReason(e.target.value)}
                className="w-full p-3 bg-white border border-gray-300 rounded-xl outline-none text-sm font-medium text-gray-800"
              />
            </div>
            <button 
              type="button"
              onClick={addClosure}
              disabled={!newClosureDate}
              className="md:col-span-1 w-full bg-gray-900 text-white font-black py-3 px-4 rounded-xl hover:bg-black transition active:scale-95 disabled:opacity-40 text-sm"
            >
              追加 (Add)
            </button>
            <p className="md:col-span-4 text-[10px] font-bold text-gray-400 mt-1">※ 時間を空欄にした場合は「臨時休業」として処理されます。</p>
          </div>

          {/* 📱 MOBILE VIEW: List preview grouped by month */}
          <div className="md:hidden mt-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-inner">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">設定済みの予定</h4>
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
              {Object.entries(scheduleByMonth).map(([monthLabel, days]) => {
                const modifiedDays = days.filter((d: any) => d.status === 'temp_closed' || d.status === 'modified');
                if (modifiedDays.length === 0) return null;

                return (
                  <div key={monthLabel}>
                    <h5 className="text-xs font-black text-gray-800 mb-2 border-b border-gray-100 pb-1">{monthLabel}</h5>
                    <div className="space-y-2">
                      {modifiedDays.map((day: any, idx: number) => (
                        <div key={idx} className={`flex justify-between items-center text-xs p-3 rounded-xl border ${day.status === 'modified' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-100'}`}>
                          <span className={`font-black flex flex-col gap-0.5 ${day.status === 'modified' ? 'text-yellow-800' : 'text-red-700'}`}>
                            <span>{day.displayDate} ({day.dayName})</span>
                            <span className="text-[10px] opacity-70">{day.overrideReason}</span>
                          </span>
                          <div className="text-right">
                             <span className={`font-black ${day.status === 'modified' ? 'text-yellow-700' : 'text-red-500'}`}>
                               {day.hoursText}
                             </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeClosure(temporaryClosures.findIndex(c => c.date === day.ymd))}
                            className="ml-3 text-gray-400 hover:text-red-600 font-black p-2 bg-white rounded-lg shadow-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 💻 PC VIEW: Interactive Month Pager Calendar */}
          <div className="hidden md:block bg-white p-5 rounded-2xl border border-gray-200 shadow-inner">
            <div className="flex justify-between items-end mb-4 border-b border-gray-100 pb-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                カレンダー操作 (Interactive Calendar)
              </h4>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">
                ※ クリックで休業のON/OFFを切り替えられます
              </span>
            </div>
            
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <button 
                  type="button"
                  onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentMonthIndex === 0}
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition font-black text-gray-600 text-xs"
                >
                  &lt;
                </button>
                <h5 className="text-sm font-black text-gray-900">{currentMonthLabel}</h5>
                <button 
                  type="button"
                  onClick={() => setCurrentMonthIndex(prev => Math.min(monthKeys.length - 1, prev + 1))}
                  disabled={currentMonthIndex === monthKeys.length - 1}
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition font-black text-gray-600 text-xs"
                >
                  &gt;
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_HEADERS.map(h => (
                  <div key={h} className="text-center text-[10px] font-black text-gray-400">{h}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {Array(currentMonthDays[0]?.dayIndex || 0).fill(null).map((_, i) => (
                  <div key={`empty-${currentMonthLabel}-${i}`} className="p-2" />
                ))}
                
                {currentMonthDays.map((day: any, idx: number) => (
                  <div 
                    key={`desk-${idx}`} 
                    onClick={() => !day.isToday ? handleCalendarClick(day.ymd) : null}
                    className={`cursor-pointer aspect-square rounded-xl border flex flex-col items-center justify-center text-center group relative transition-all active:scale-95 ${
                      day.isToday ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' : 
                      day.status === 'open' ? 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 shadow-sm' : 
                      day.status === 'modified' ? 'bg-yellow-50 border-yellow-300 shadow-inner ring-2 ring-yellow-200/50' : 
                      day.status === 'temp_closed' ? 'bg-red-50 border-red-400 shadow-inner ring-2 ring-red-200/50' :
                      'bg-gray-50 border-gray-200 opacity-75'
                    }`}
                  >
                    <span className={`text-[11px] font-black leading-none mb-1.5 ${day.isHoliday ? 'text-red-500' : 'text-gray-700'}`}>
                      {day.displayDate.split('/')[1]}
                    </span>
                    
                    <span className="text-lg leading-none drop-shadow-sm">
                      {day.status === 'open' ? '🟢' : day.status === 'modified' ? '🕒' : day.status === 'sold_out' ? '🟠' : '🔴'}
                    </span>

                    {(day.status === 'temp_closed' || day.status === 'modified') && !day.isToday && (
                       <span className={`absolute -top-1.5 -right-1.5 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md z-10 transition group-hover:scale-110 ${day.status === 'modified' ? 'bg-yellow-500' : 'bg-red-500'}`}>✕</span>
                    )}

                    {!day.isToday && (
                      <div className="absolute bottom-[105%] mb-2 hidden group-hover:block w-max max-w-[180px] bg-gray-900 text-white text-[10px] font-bold p-2.5 rounded-lg shadow-xl z-50 pointer-events-none">
                        <div className="mb-1 border-b border-gray-700 pb-1">{day.ymd} ({day.dayName})</div>
                        <div className={day.status === 'open' ? 'text-gray-300' : day.status === 'modified' ? 'text-yellow-400' : 'text-red-400'}>
                          {day.overrideReason || day.hoursText}
                        </div>
                        <div className={day.status === 'modified' ? 'text-white font-black mt-1 bg-gray-800 p-1 rounded' : ''}>
                          {day.hoursText}
                        </div>
                        <span className="text-blue-300 mt-1.5 block">
                          👆 クリックで{(day.status === 'temp_closed' || day.status === 'modified') ? '設定を解除' : '設定を適用'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 🚀 REDESIGNED: FRAMELESS EDITORIAL CALENDAR EXPORT */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mt-12 mb-6 gap-4 px-2">
          <div>
            <h3 className="font-black text-gray-900 mb-1">SNS・店頭用カレンダー (Shareable Calendar)</h3>
            <p className="text-xs text-gray-500 font-bold">Instagramや店頭への掲示に使える綺麗な画像を出力できます。</p>
          </div>
          <button 
            type="button"
            onClick={downloadCalendarImage}
            className="w-full md:w-auto shrink-0 bg-blue-600 text-white font-black py-2.5 px-5 rounded-xl hover:bg-blue-700 transition active:scale-95 text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            📸 画像をダウンロード (PNG)
          </button>
        </div>

        {/* 🖨️ THE PRINTABLE CANVAS (Frameless, clean, editorial) */}
        <div className="w-full overflow-x-auto hide-scrollbar pb-8">
          <div id="printable-calendar" className="w-[800px] bg-white p-8 mx-auto font-sans text-slate-800">
            
            {/* Elegant Header */}
            <div className="flex justify-between items-baseline mb-4 border-b-2 border-slate-800 pb-3">
              <div className="flex items-baseline gap-4">
                <h1 className="text-3xl font-black tracking-tight">{restaurant?.title}</h1>
                <span className="text-sm font-bold text-slate-500 tracking-widest">営業カレンダー</span>
              </div>
              <div className="text-2xl font-black tracking-widest">
                {currentMonthLabel}
              </div>
            </div>

            {/* Day Headers (Hairline Grid Setup) */}
            <div className="grid grid-cols-7 gap-[1px] bg-slate-200 border-t border-l border-r border-slate-200">
              {DAY_HEADERS.map((h, i) => (
                <div key={h} className={`bg-slate-50 text-center py-2 text-[10px] font-black tracking-widest ${i === 0 || h === '祝' ? 'text-rose-600' : 'text-slate-500'}`}>
                  {h}
                </div>
              ))}
            </div>

            {/* Grid Cells (Hairline 1px borders via gap) */}
            <div className="grid grid-cols-7 gap-[1px] bg-slate-200 border-b border-l border-r border-slate-200">
              
              {/* Empty Offset */}
              {Array(currentMonthDays[0]?.dayIndex || 0).fill(null).map((_, i) => (
                <div key={`print-empty-${i}`} className="bg-white h-24" />
              ))}
              
              {/* Actual Days */}
              {currentMonthDays.map((day: any, idx: number) => {
                const isHolidayOrSunday = day.isHoliday || day.dayIndex === 0;
                return (
                  <div key={`print-${idx}`} className={`h-24 flex flex-col relative p-2 ${
                    day.status === 'open' ? 'bg-white' : 
                    day.status === 'modified' ? 'bg-amber-50/50' : 
                    'bg-slate-50/80'
                  }`}>
                    {/* Date Top Left */}
                    <span className={`text-xs font-black ${isHolidayOrSunday ? 'text-rose-600' : 'text-slate-700'}`}>
                      {day.displayDate.split('/')[1]}
                    </span>
                    
                    {/* Content Bottom Right */}
                    <div className="flex-1 flex flex-col justify-end items-end pb-1 pr-1">
                      {day.status === 'open' ? (
                        <span className="text-[11px] font-bold text-slate-500 leading-tight">{day.hoursText}</span>
                      ) : day.status === 'modified' ? (
                        <div className="text-right">
                           <span className="text-[9px] font-black text-amber-600 border border-amber-200 bg-amber-100/50 px-1 rounded block mb-0.5 w-max ml-auto">時間変更</span>
                           <span className="text-[11px] font-bold text-slate-800 leading-tight block">{day.hoursText}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-slate-400 tracking-widest">休業</span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Empty Trailer */}
              {Array((7 - ((currentMonthDays[0]?.dayIndex || 0) + currentMonthDays.length) % 7) % 7).fill(null).map((_, i) => (
                <div key={`print-end-empty-${i}`} className="bg-white h-24" />
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-between items-center text-[9px] text-slate-400 font-bold tracking-widest">
              <span>※ 営業時間は予告なく変更となる場合がございます。</span>
              <span className="uppercase">Generated via Eatodakimasu</span>
            </div>
          </div>
        </div>

        <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <h3 className="font-black text-gray-900 mb-4">メニューの品切れ管理 (Sold Out Toggles)</h3>
          {menuItems.length === 0 ? (
            <p className="text-sm text-gray-500 font-bold">メニューが登録されていません。</p>
          ) : (
            <div className="space-y-3">
              {menuItems.map((item, idx) => (
                <div key={idx} className={`flex justify-between items-center p-4 rounded-xl border ${item.isSoldOut ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div>
                    <div className={`font-black ${item.isSoldOut ? 'line-through text-gray-500' : 'text-gray-900'}`}>{item.name}</div>
                    <div className="text-xs font-bold text-gray-500">¥{item.price}</div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => toggleMenuItemSoldOut(idx)}
                    className={`px-4 py-2 rounded-lg font-black text-xs transition ${item.isSoldOut ? 'bg-gray-300 text-gray-700' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                  >
                    {item.isSoldOut ? '販売再開 (Resume)' : '完売 (Set Sold Out)'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 flex flex-col items-center z-40">
        {successMsg && <span className="text-green-600 font-bold text-sm mb-2 animate-bounce">{successMsg}</span>}
        <button 
          type="button"
          onClick={() => setShowPinModal(true)} 
          className="w-full max-w-md bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition active:scale-95"
        >
          変更を保存する (Publish Changes)
        </button>
      </div>

      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">PINコード入力</h3>
            <p className="text-xs font-bold text-gray-500 mb-6">設定した4桁の暗証番号を入力してください。</p>
            
            <input
              type="password"
              maxLength={4}
              pattern="\d{4}"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-32 p-4 text-center text-2xl tracking-[0.5em] font-black border-2 border-blue-300 rounded-2xl outline-none focus:border-blue-500 mx-auto block mb-4"
              placeholder="PIN"
            />
            
            {pinError && <p className="text-red-500 font-bold text-xs bg-red-50 px-3 py-2 rounded-md mb-4">{pinError}</p>}
            
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setShowPinModal(false)} 
                className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-gray-600 hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button 
                type="submit" 
                disabled={saving || pin.length < 4} 
                className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl shadow-md disabled:opacity-50 hover:bg-blue-700"
              >
                {saving ? '...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}