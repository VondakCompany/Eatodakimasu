// /lib/timeUtils.ts
import * as JapaneseHolidays from 'japanese-holidays';

const DAYS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

export const isOpenNow = (operatingHoursStr: any): boolean => {
  if (!operatingHoursStr) return false;

  let hoursObj: Record<string, string> = {};
  
  // 1. Parse the incoming JSON cleanly
  try {
    if (typeof operatingHoursStr === 'string') {
      if (!operatingHoursStr.trim().startsWith('{')) return false; // Ignore legacy text blocks
      hoursObj = JSON.parse(operatingHoursStr);
    } else if (typeof operatingHoursStr === 'object' && operatingHoursStr !== null) {
      hoursObj = operatingHoursStr;
    }
  } catch (e) {
    return false;
  }

  // 2. Lock timezone to JST (Asia/Tokyo) to prevent overseas offset bugs
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  
  // 3. Determine the correct day key
  let todayKey = DAYS[now.getDay()];
  
  if (JapaneseHolidays.isHoliday(now)) {
    todayKey = '祝日'; // Force the engine to look at the holiday column!
  }

  // 4. Fetch today's text (e.g., "11:00 - 22:00")
  const todayHours = hoursObj[todayKey];
  
  // If blank, null, or explicitly marked as closed/holiday ("休")
  if (!todayHours || todayHours.trim() === '' || todayHours.includes('休') || todayHours.includes('定休')) {
    return false; 
  }

  // 5. Convert current time to total minutes for easy comparison (e.g. 1:30 PM = 810 mins)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 6. Support multiple shifts like "11:00-15:00, 17:00-22:00"
  const timeRanges = todayHours.split(',').map(s => s.trim());
  
  for (const range of timeRanges) {
     // Split by standard dash, full-width dash, or tilde
     const parts = range.split(/[~\-ー]/);
     if (parts.length === 2) {
        const startParts = parts[0].trim().split(':');
        const endParts = parts[1].trim().split(':');
        
        if (startParts.length === 2 && endParts.length >= 1) {
           const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
           let endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || '0');
           
           // Handle past-midnight closing times (e.g., "17:00 - 26:00" OR "17:00 - 02:00")
           let adjustedEnd = endMins;
           if (endMins < startMins) adjustedEnd += 24 * 60; 
           
           let adjustedCurrent = currentMinutes;
           // If it's currently 1 AM, and the restaurant is open until 2 AM, shift the current time up by 24h to match
           if (currentMinutes < startMins && currentMinutes < 4 * 60) {
              adjustedCurrent += 24 * 60;
           }

           if (adjustedCurrent >= startMins && adjustedCurrent <= adjustedEnd) {
              return true;
           }
        }
     }
  }
  
  return false;
};