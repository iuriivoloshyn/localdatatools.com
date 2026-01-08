
export interface ColumnAnalysis {
  name: string;
  type: 'date' | 'number' | 'categorical' | 'text';
  uniqueCount: number;
  min?: number;
  max?: number;
  sum?: number;
  avg?: number;
}

export interface WidgetConfig {
  id: string;
  type: 'kpi' | 'timeline' | 'bar' | 'pie';
  title: string;
  dataKey: string;
  secondaryKey?: string; // For aggregation
  aggregation: 'count' | 'sum' | 'avg';
  color?: string;
  colSpan?: number; // 1 to 4
}

export const analyzeColumns = (data: any[], headers: string[]): ColumnAnalysis[] => {
  if (data.length === 0) return [];
  
  // Sample up to 100 rows for type detection
  const sample = data.slice(0, 100);
  
  return headers.map(header => {
    const values = sample.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '');
    
    // Type Detection Heuristics
    let isNumber = true;
    let isDate = true;
    
    // Quick check on first few non-empty
    if (values.length === 0) {
        return { name: header, type: 'text', uniqueCount: 0 };
    }

    for (const v of values) {
      if (isNaN(Number(v))) isNumber = false;
      if (isNaN(Date.parse(String(v)))) isDate = false;
      if (!isNumber && !isDate) break;
    }

    // Refine Date vs Number (Numbers often parse as dates like year 2023)
    if (isDate && isNumber) {
        // If it looks like a year (1990-2100), treat as date only if header implies it
        const numVal = Number(values[0]);
        if (numVal < 1900 || numVal > 2100) isDate = false; 
    }
    
    const type = isDate ? 'date' : isNumber ? 'number' : 'text';
    
    // Stats for numbers
    let stats: Partial<ColumnAnalysis> = {};
    if (type === 'number') {
        const allNums = data.map(r => Number(r[header])).filter(n => !isNaN(n));
        if (allNums.length > 0) {
            const sum = allNums.reduce((a, b) => a + b, 0);
            stats = {
                min: Math.min(...allNums),
                max: Math.max(...allNums),
                sum,
                avg: sum / allNums.length
            };
        }
    }

    // Unique count for categorization
    const unique = new Set(data.map(r => r[header])).size;
    const isCategorical = type === 'text' && unique <= 20 && unique > 0;

    return {
      name: header,
      type: isCategorical ? 'categorical' : type,
      uniqueCount: unique,
      ...stats
    };
  });
};

export const generateWidgets = (analysis: ColumnAnalysis[]): WidgetConfig[] => {
  const widgets: WidgetConfig[] = [];
  let idCounter = 0;

  // 1. KPIs: Top numeric columns (Total/Avg)
  const numbers = analysis.filter(c => c.type === 'number');
  // Sort by variance or just pick first few? Pick first 3.
  numbers.slice(0, 3).forEach(numCol => {
      widgets.push({
          id: `kpi-${idCounter++}`,
          type: 'kpi',
          title: `Total ${numCol.name}`,
          dataKey: numCol.name,
          aggregation: 'sum',
          colSpan: 1
      });
  });

  // 2. Timeline: Best date column
  const dates = analysis.filter(c => c.type === 'date');
  if (dates.length > 0) {
      widgets.push({
          id: `timeline-${idCounter++}`,
          type: 'timeline',
          title: `${dates[0].name} Trend`,
          dataKey: dates[0].name,
          aggregation: 'count', // Count records per date
          colSpan: 4 // Full width
      });
  }

  // 3. Categorical Distributions
  const cats = analysis.filter(c => c.type === 'categorical');
  cats.slice(0, 4).forEach((cat, idx) => {
      // Alternate between Bar and Pie/Donut (represented as 'bar' here for simplicity in initial implementation)
      widgets.push({
          id: `cat-${idCounter++}`,
          type: 'bar',
          title: `${cat.name} Distribution`,
          dataKey: cat.name,
          aggregation: 'count',
          colSpan: 2 // Half width
      });
  });

  return widgets;
};

// Aggregation Helper
export const aggregateData = (data: any[], config: WidgetConfig, filters: Record<string, any>) => {
    // 1. Filter Data
    const filtered = data.filter(row => {
        for (const [key, val] of Object.entries(filters)) {
            // Check if widget itself is the source of filter? 
            // In cross-filter, usually clicking a bar filters OTHERS. 
            // The widget itself usually stays full or highlights selection.
            // For simplicity here: Filter everything except the dimension being visualized?
            // Actually, standard behavior: Global filter affects everyone.
            // But if I filter "Region=US", the Region chart shows only "US".
            if (row[key] !== val) return false;
        }
        return true;
    });

    if (config.type === 'kpi') {
        if (config.aggregation === 'sum') {
            const sum = filtered.reduce((acc, r) => acc + (Number(r[config.dataKey]) || 0), 0);
            return sum;
        }
        if (config.aggregation === 'avg') {
            const sum = filtered.reduce((acc, r) => acc + (Number(r[config.dataKey]) || 0), 0);
            return sum / (filtered.length || 1);
        }
    }

    if (config.type === 'bar' || config.type === 'timeline') {
        const counts: Record<string, number> = {};
        
        filtered.forEach(row => {
            let val = row[config.dataKey];
            if (config.type === 'timeline') {
                // Bin by Month/Day? Let's just stringify for now or YYYY-MM
                try {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) val = d.toISOString().split('T')[0]; // Daily
                } catch(e) {}
            }
            val = String(val);
            counts[val] = (counts[val] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => config.type === 'timeline' ? a.name.localeCompare(b.name) : b.value - a.value)
            .slice(0, config.type === 'timeline' ? 50 : 10); // Limit bars
    }

    return [];
};
