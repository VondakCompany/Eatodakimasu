export type ChangeLog = {
      field: string;
      oldValue: any;
      newValue: any;
      message: string;
    };
    
    export function generateDiffLog(currentState: Record<string, any>, deltaUpdate: Record<string, any>): ChangeLog[] {
      const logs: ChangeLog[] = [];
      
      for (const key in deltaUpdate) {
        // Stringify objects/arrays to accurately compare JSONB/Array fields like 'cuisine' or 'translations'
        const oldStr = JSON.stringify(currentState[key] ?? null);
        const newStr = JSON.stringify(deltaUpdate[key] ?? null);
    
        if (oldStr !== newStr) {
          logs.push({
            field: key,
            oldValue: currentState[key] ?? null,
            newValue: deltaUpdate[key],
            message: `Updated '${key}' from ${oldStr} to ${newStr}`
          });
        }
      }
      
      return logs;
    } 