export function isOpenNow(operatingHours: any): boolean {
  if (!operatingHours) return false;

  try {
    // 1. Bulletproof JST Time Extraction (Asia/Tokyo)
    const now = new Date();
    const jstFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    
    const parts = jstFormatter.formatToParts(now);
    const weekdayShort = parts.find(p => p.type === 'weekday')?.value; 
    const hourStr = parts.find(p => p.type === 'hour')?.value || '0';
    const minuteStr = parts.find(p => p.type === 'minute')?.value || '0';
    
    const currentHour = parseInt(hourStr, 10);
    const currentMinute = parseInt(minuteStr, 10);
    const currentTimeVal = currentHour + currentMinute / 60;

    const dayMap: Record<string, string> = {
      'Sun': '日曜日', 'Mon': '月曜日', 'Tue': '火曜日', 
      'Wed': '水曜日', 'Thu': '木曜日', 'Fri': '金曜日', 'Sat': '土曜日'
    };
    const todayString = dayMap[weekdayShort || 'Sun'];
    const shortToday = todayString.replace('曜日', '');

    // 2. Extract ONLY today's operating hours string FIRST (prevents JSON corruption)
    let todayHoursRaw = '';

    if (typeof operatingHours === 'object' && operatingHours !== null) {
      todayHoursRaw = operatingHours[todayString] || operatingHours[shortToday] || operatingHours[`${shortToday}曜`] || '';
    } else if (typeof operatingHours === 'string') {
      if (operatingHours.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(operatingHours);
          todayHoursRaw = parsed[todayString] || parsed[shortToday] || parsed[`${shortToday}曜`] || '';
        } catch (e) {}
      } else {
        // Legacy flat string support
        const lines = operatingHours.split(/\\n|\n/);
        const todayLine = lines.find(line => line.includes(todayString) || line.includes(`${shortToday}曜`));
        if (todayLine) {
          todayHoursRaw = todayLine;
        }
      }
    }

    if (!todayHoursRaw || todayHoursRaw.includes('定休') || todayHoursRaw.includes('休業') || todayHoursRaw.includes('休')) {
      return false;
    }

    // 3. Brutally normalize Japanese text (Only on today's extracted string)
    // Convert full-width numbers and colons to half-width (e.g., １１：００ -> 11:00)
    todayHoursRaw = todayHoursRaw.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    
    // Convert all possible Japanese tildes, wave dashes, and minus signs to a standard dash '-'
    todayHoursRaw = todayHoursRaw.replace(/[〜～~ー−]/g, '-');
    
    // Remove all spaces for easier parsing
    todayHoursRaw = todayHoursRaw.replace(/\s/g, '');

    // 4. Extract time ranges (The while loop inherently supports comma-separated split shifts)
    const timeRegex = /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g;
    let match;
    let hasValidTimes = false;

    while ((match = timeRegex.exec(todayHoursRaw)) !== null) {
      hasValidTimes = true;
      const startHour = parseInt(match[1], 10);
      const startMin = parseInt(match[2], 10);
      let endHour = parseInt(match[3], 10);
      const endMin = parseInt(match[4], 10);

      const startTimeVal = startHour + startMin / 60;
      let endTimeVal = endHour + endMin / 60;

      // Handle late-night wraparound (e.g., 17:00-02:00 or 17:00-26:00)
      if (endTimeVal <= startTimeVal) {
        endTimeVal += 24; 
      }

      let checkTimeVal = currentTimeVal;
      
      // If it is currently past midnight (e.g., 1 AM = 1.0) 
      // AND the shift started yesterday afternoon/evening (>= 12), wrap checkTime to 25.0
      if (currentHour < 5 && startTimeVal >= 12) {
        checkTimeVal += 24;
      }

      // We check if the current time falls inside the specific shift we are currently iterating over
      if (checkTimeVal >= startTimeVal && checkTimeVal < endTimeVal) {
        return true; 
      }
    }

    // If the loop finishes checking all shifts and hasn't returned true, they are closed.
    return false;

  } catch (e) {
    console.error("Time parsing error:", e);
    return false;
  }
}