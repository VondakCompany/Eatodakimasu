// lib/timeUtils.ts

export function isOpenNow(operatingHours: any): boolean {
      if (!operatingHours) return false;
    
      try {
        // 1. Get current JST Time (Tokyo) regardless of user's local device time
        const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        const currentDayIndex = jstNow.getDay(); // 0 = Sun, 1 = Mon...
        const currentHour = jstNow.getHours();
        const currentMinute = jstNow.getMinutes();
        const currentTimeVal = currentHour + currentMinute / 60; // e.g., 14.5 for 2:30 PM
    
        const DAYS_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
        const todayString = DAYS_JA[currentDayIndex];
        const shortToday = todayString.replace('曜日', ''); // '月', '火', etc.
    
        // 2. Stringify and brutally normalize Japanese text
        let rawText = typeof operatingHours === 'object' ? JSON.stringify(operatingHours) : String(operatingHours);
        
        // Convert full-width numbers and colons to half-width (e.g., １１：００ -> 11:00)
        rawText = rawText.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        
        // Convert all possible Japanese tildes, wave dashes, and minus signs to a standard dash '-'
        rawText = rawText.replace(/[〜～~ー−]/g, '-');
        
        // Remove all spaces for easier parsing
        rawText = rawText.replace(/\s/g, '');
    
        // 3. Extract ONLY today's operating hours line
        let todayHoursRaw = rawText;
        if (rawText.startsWith('{')) {
          // Handle legacy JSON
          try {
            const parsed = JSON.parse(rawText);
            todayHoursRaw = parsed[todayString] || parsed[shortToday] || parsed[`${shortToday}曜`] || '';
          } catch (e) {}
        } else {
          // Handle multi-line text block
          const lines = rawText.split(/\\n|\n|,|、/);
          const todayLine = lines.find(line => line.includes(todayString) || line.includes(`${shortToday}曜`));
          if (todayLine) {
            todayHoursRaw = todayLine;
          }
        }
    
        // If it explicitly says closed, return false instantly
        if (!todayHoursRaw || todayHoursRaw.includes('定休') || todayHoursRaw.includes('休業') || todayHoursRaw === '休') {
          return false;
        }
    
        // 4. Extract time ranges (e.g., 11:00-14:00, 17:00-22:00)
        // Regex looks for "1 or 2 digits : 2 digits - 1 or 2 digits : 2 digits"
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
          // Treat the current time as 25.0 so it correctly falls inside "17.0 - 26.0"
          if (currentHour < 5) {
            checkTimeVal += 24;
          }
    
          // Check if current time falls within this range
          if (checkTimeVal >= startTimeVal && checkTimeVal < endTimeVal) {
            console.log(`✅ OPEN: ${todayHoursRaw} (Current Time: ${currentHour}:${currentMinute})`);
            return true; 
          }
        }
    
        // If we found valid time ranges but none returned true, the shop is currently closed.
        if (hasValidTimes) {
          console.log(`❌ CLOSED: ${todayHoursRaw} (Current Time: ${currentHour}:${currentMinute})`);
          return false;
        }
    
        // Fallback: If we couldn't find any numbers (e.g., "Googleマップに準ずる"), we exclude it from the "Open Now" filter
        return false;
    
      } catch (e) {
        console.error("Time parsing error:", e);
        return false;
      }
    }