export const isOpenNow = (operatingHours: any) => {
      if (!operatingHours || typeof operatingHours !== 'object') return null;
    
      // Map JS getDay() (0-6, Sun-Sat) to your Japanese database keys
      const dayMap: Record<number, string> = {
        0: '日曜日', 1: '月曜日', 2: '火曜日', 3: '水曜日',
        4: '木曜日', 5: '金曜日', 6: '土曜日'
      };
    
      const now = new Date();
      // Standardize time as a comparable integer (e.g., 14:30 -> 1430)
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const currentDay = dayMap[now.getDay()];
    
      const todayHours = operatingHours[currentDay];
      
      // If explicitly marked as closed or empty
      if (!todayHours || todayHours.includes('定休') || todayHours.trim() === '') return false;
    
      // Handle multiple time slots (e.g., "11:00〜14:00、17:00〜21:00")
      // We split by common Japanese delimiters
      const slots = todayHours.split(/[、,，/]/);
      
      for (const slot of slots) {
        // Look for patterns like HH:MM
        const times = slot.match(/(\d{1,2}):(\d{2})/g);
        
        if (times && times.length === 2) {
          const open = parseInt(times[0].replace(':', ''));
          const close = parseInt(times[1].replace(':', ''));
    
          // Handle overnight hours (e.g., 18:00 - 02:00)
          if (close < open) {
            if (currentTime >= open || currentTime <= close) return true;
          } else {
            if (currentTime >= open && currentTime <= close) return true;
          }
        }
      }
    
      return false;
    };