
export interface ColumnAnalysis {
  name: string;
  type: 'date' | 'number' | 'categorical' | 'text';
  uniqueCount: number;
  min?: number;
  max?: number;
  sum?: number;
  avg?: number;
  isIdLike?: boolean; // Heuristic based on name
  isUniform?: boolean; // Heuristic based on data distribution (e.g. 100% unique)
  samples?: any[]; // First few non-null values
  topValues?: any[]; // Most frequent values
}

export interface WidgetConfig {
  id: string;
  type: 'kpi' | 'timeline' | 'bar' | 'pie' | 'line' | 'area' | 'donut' | 'scatter';
  title: string;
  dataKey: string;
  secondaryKey?: string; // For aggregation
  aggregation: 'count' | 'sum' | 'avg' | 'median' | 'min' | 'max' | 'stddev' | 'variance' | 'distinct' | 'mode';
  color?: string;
  colSpan?: number; // 1 to 4
  limit?: number; // Limit number of items (e.g. Top 5)
  orientation?: 'vertical' | 'horizontal'; // For bar charts
  timeGrain?: 'auto' | 'day' | 'week' | 'month' | 'year';
}

export const analyzeColumns = (data: any[], headers: string[]): ColumnAnalysis[] => {
  if (data.length === 0) return [];
  
  // Sample up to 200 rows for type detection
  const sample = data.slice(0, 200);
  
  return headers.map(header => {
    // For type detection, we only care about valid values
    const values = sample.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '');
    
    // Type Detection Heuristics
    let isNumber = true;
    let isDate = true;
    
    if (values.length === 0) {
        // Even if empty in sample, it might have blank values later. We default to text.
        // We still need to process distribution below.
    } else {
        for (const v of values) {
          if (isNaN(Number(v))) isNumber = false;
          if (isNaN(Date.parse(String(v)))) isDate = false;
          if (!isNumber && !isDate) break;
        }

        if (isDate && isNumber) {
            const numVal = Number(values[0]);
            if (numVal < 1900 || numVal > 2100) isDate = false; 
        }
    }
    
    const lowerHeader = header.toLowerCase();
    const isIdLike = /id$|code$|index$|no\.$|uuid|guid|key/.test(lowerHeader) && !lowerHeader.includes('amount') && !lowerHeader.includes('price');

    const type = isDate ? 'date' : isNumber ? 'number' : 'text';
    
    let stats: Partial<ColumnAnalysis> = {};
    if (type === 'number') {
        const allNums = data.map(r => Number(r[header])).filter(n => !isNaN(n));
        if (allNums.length > 0) {
            let min = Infinity;
            let max = -Infinity;
            let sum = 0;
            for(let i = 0; i < allNums.length; i++) {
                const n = allNums[i];
                if(n < min) min = n;
                if(n > max) max = n;
                sum += n;
            }
            stats = {
                min,
                max,
                sum,
                avg: sum / allNums.length
            };
        }
    }

    // Advanced Analysis for AI Context & Filtering
    // We must include blank values here so they appear in filters
    const uniqueScanLimit = Math.min(data.length, 5000); 
    const uniqueValues = new Set();
    const frequency: Record<string, number> = {};
    
    for(let i = 0; i < uniqueScanLimit; i++) {
        const rowVal = data[i][header];
        // Convert null/undefined/empty to (Blank) for categorization
        let strVal = String(rowVal);
        if (rowVal === undefined || rowVal === null || strVal.trim() === '') {
            strVal = '(Blank)';
        }
        
        uniqueValues.add(strVal);
        frequency[strVal] = (frequency[strVal] || 0) + 1;
    }

    const unique = uniqueValues.size;
    const isUniform = (unique === uniqueScanLimit && uniqueScanLimit > 20);
    
    // Categorical if relatively few unique values compared to row count (and not just unique IDs)
    const isCategorical = type === 'text' && unique <= 100 && !isUniform;

    // Get top 100 most frequent values including (Blank)
    const topValues = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1]) // Sort desc by count
        .slice(0, 100)
        .map(e => e[0]);

    return {
      name: header,
      type: isCategorical ? 'categorical' : type,
      uniqueCount: unique,
      isIdLike,
      isUniform,
      samples: values.slice(0, 5), // Keep samples as valid values for context
      topValues,
      ...stats
    };
  });
};

export const generateWidgets = (analysis: ColumnAnalysis[]): WidgetConfig[] => {
  return []; 
};

export const aggregateData = (data: any[], config: WidgetConfig, filters: Record<string, any>) => {
    return [];
};
