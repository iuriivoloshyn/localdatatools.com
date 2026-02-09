
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ExtendedWidgetConfig, FilterConfig } from './types';
import { NEON_PALETTE } from './constants';
import { 
    Activity, BarChart3, LineChart, Layers, PieChart, Circle, ScatterChart, Calendar, ChevronDown, Filter, X, Settings
} from 'lucide-react';

const getFilterLabel = (filter: FilterConfig) => {
    if (filter.type === 'range') {
        const minStr = filter.min !== undefined ? filter.min : '';
        const maxStr = filter.max !== undefined ? filter.max : '';
        if (minStr !== '' && maxStr !== '') return `${minStr} - ${maxStr}`;
        if (minStr !== '') return `> ${minStr}`;
        if (maxStr !== '') return `< ${maxStr}`;
        return 'Range';
    }
    if (filter.selected && filter.selected.length > 0) {
        if (filter.selected.length === 1) return filter.selected[0];
        if (filter.selected.length === 2) return filter.selected.join(', ');
        return `${filter.selected.length} items`;
    }
    return 'All';
};

export const KpiWidget = ({ config, value, onClick, onEditFilters, onEditSettings }: { config: ExtendedWidgetConfig, value: number, onClick?: () => void, onEditFilters?: () => void, onEditSettings?: () => void }) => (
    <div 
        onClick={onClick}
        className={`bg-gray-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-center items-center text-center h-full group relative overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-violet-500/30 hover:bg-gray-900/60' : ''}`}
    >
        <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEditFilters && (
                <button 
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEditFilters(); }} 
                    className={`p-1.5 rounded-lg transition-colors ${config.filters && Object.keys(config.filters).length > 0 ? 'bg-violet-500/20 text-violet-300' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    title="Filter Widget"
                >
                    <Filter size={12} fill={config.filters && Object.keys(config.filters).length > 0 ? "currentColor" : "none"} />
                </button>
            )}
            {onEditSettings && (
                <button 
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEditSettings(); }} 
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Edit Settings"
                >
                    <Settings size={12} />
                </button>
            )}
        </div>
        
        <div className="z-10 relative flex flex-col items-center justify-center w-full h-full pointer-events-none">
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center justify-center gap-2 truncate w-full">
                <Activity size={12} className="text-cyan-400 shrink-0" />
                <span className="truncate">{config.title}</span>
            </h3>
            <div className="text-3xl md:text-4xl font-black text-white tracking-tight truncate mt-2">
                {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
            {config.filters && Object.keys(config.filters).length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-3">
                    {Object.entries(config.filters).map(([key, filter]) => {
                        const label = getFilterLabel(filter);
                        if (label === 'All') return null;
                        return (
                            <span key={key} className="px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[9px] font-mono">
                                {key}: {label}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
);

// --- UTILS ---
const formatValue = (num: number) => {
    if (num === 0) return '0';
    if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    if (Math.abs(num) < 0.01) return num.toExponential(1);
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

// "Nice Number" Algorithm for Axis
const calculateNiceScale = (min: number, max: number, tickCount = 5) => {
    if (min === max) {
        if (min === 0) return { min: 0, max: 10, ticks: [0, 2.5, 5, 7.5, 10] };
        min = Math.floor(min * 0.9);
        max = Math.ceil(max * 1.1);
    }

    const range = max - min;
    const roughTickInterval = range / (tickCount - 1);
    const x = Math.pow(10, Math.floor(Math.log10(roughTickInterval)));
    const y = roughTickInterval / x;
    
    let normalizedTickInterval;
    if (y < 1.5) normalizedTickInterval = 1;
    else if (y < 3) normalizedTickInterval = 2;
    else if (y < 7) normalizedTickInterval = 5;
    else normalizedTickInterval = 10;
    
    const tickInterval = normalizedTickInterval * x;
    const niceMin = Math.floor(min / tickInterval) * tickInterval;
    const niceMax = Math.ceil(max / tickInterval) * tickInterval;
    
    const ticks = [];
    for (let t = niceMin; t <= niceMax + (tickInterval*0.1); t += tickInterval) {
        ticks.push(t);
    }
    
    return { min: niceMin, max: niceMax, ticks };
};

// --- CHART ENGINE ---
export const ChartWidget = ({ config, data, onConfigUpdate, onEditFilters, onEditSettings }: { config: ExtendedWidgetConfig, data: any[], onConfigUpdate?: (cfg: ExtendedWidgetConfig) => void, onEditFilters?: () => void, onEditSettings?: () => void }) => {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const timeMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (timeMenuRef.current && !timeMenuRef.current.contains(event.target as Node)) {
                setIsTimeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Resize Observer for SVG
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Identify Series
    const metrics = useMemo(() => {
        if (config.metricKeys && config.metricKeys.length > 0) return config.metricKeys;
        if (config.secondaryKey) return [config.secondaryKey];
        return ['Count']; // Default
    }, [config]);

    // Process Data
    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        let processed = [...data];
        const isTimeChart = ['timeline', 'line', 'area'].includes(config.type);
        const sortKey = metrics[0] || 'value';

        // --- 1. RANKING / FILTERING PHASE ---
        // If a limit is set (Top N), we first rank the data to get the most relevant items.
        // We do this BEFORE the display sort, so "Top 5 sorted Z-A" shows the biggest 5 items, alphabetically.
        // Exception: If the user explicitly wants "Lowest Value", we rank ascending.
        // Exception: Time charts generally respect chronological order, limit usually implies range, not rank.
        
        if (!isTimeChart) {
            if (config.limit && config.limit > 0) {
                const isBottomN = config.sortBy === 'value_asc'; // User asked for smallest?
                processed.sort((a, b) => {
                    const valA = a[sortKey] || 0;
                    const valB = b[sortKey] || 0;
                    return isBottomN ? valA - valB : valB - valA; // Default to Desc (Top N)
                });
                processed = processed.slice(0, config.limit);
            } else if (config.type === 'bar' && processed.length > 50) {
                // Auto-limit safety for bars
                processed.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
                processed = processed.slice(0, 50);
            }
        }

        // --- 2. DISPLAY SORT PHASE ---
        // Now that we have the correct subset of data, arrange it for display.
        
        if (isTimeChart) {
             processed.sort((a, b) => {
                 const dA = new Date(a.name).getTime();
                 const dB = new Date(b.name).getTime();
                 if (!isNaN(dA) && !isNaN(dB)) return dA - dB;
                 return 0; 
             });
             // For time charts, limit usually means "Latest N" if we apply it after sort
             if (config.limit) processed = processed.slice(-config.limit); 
        } else {
            const mode = config.sortBy || 'value_desc';
            
            if (mode === 'value_desc') {
                processed.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
            } 
            else if (mode === 'value_asc') {
                processed.sort((a, b) => (a[sortKey] || 0) - (b[sortKey] || 0));
            } 
            else if (mode.startsWith('label')) {
                const multiplier = mode === 'label_desc' ? -1 : 1;
                const isNumeric = processed.every(d => !isNaN(parseFloat(d.name)) && isFinite(d.name));
                
                processed.sort((a, b) => {
                    const valA = a.name;
                    const valB = b.name;
                    if (isNumeric) {
                        return (parseFloat(valA) - parseFloat(valB)) * multiplier;
                    }
                    return String(valA).localeCompare(String(valB)) * multiplier;
                });
            }
        }
        
        return processed;
    }, [data, config, metrics]);

    // Scales
    const { minVal, maxVal, yTicks } = useMemo(() => {
        let min = 0;
        let max = 0;
        
        chartData.forEach(d => {
            metrics.forEach(m => {
                const val = d[m] || 0;
                if (val < min) min = val;
                if (val > max) max = val;
            });
        });
        
        const { min: niceMin, max: niceMax, ticks } = calculateNiceScale(min, max);
        return { minVal: niceMin, maxVal: niceMax, yTicks: ticks };
    }, [chartData, metrics]);

    const colors = useMemo(() => {
        if (config.chartColor) return [config.chartColor];
        return NEON_PALETTE;
    }, [config.chartColor]);

    const isPie = config.type === 'pie' || config.type === 'donut';
    const isBar = config.type === 'bar';
    const isLine = ['line', 'area', 'timeline', 'scatter'].includes(config.type);

    const { width, height } = dimensions;
    const padding = { top: 30, right: 20, bottom: 40, left: 50 }; // Reduced padding, managed by flex container
    
    // For Pie/Donut, total needed for percentages
    const totalValue = useMemo(() => {
        if (!isPie) return 0;
        return chartData.reduce((acc, d) => acc + (d[metrics[0]] || 0), 0);
    }, [chartData, isPie, metrics]);

    // Zoom Calculation
    const zoom = config.zoomLevel || 1;
    const minBarWidth = 40 * zoom; 
    
    // Calculate total width based on content if zoom > 1 or bars are many
    const computedWidth = isBar 
        ? Math.max(width, padding.left + padding.right + (chartData.length * minBarWidth * Math.max(1, metrics.length * 0.5)))
        : Math.max(width, width * zoom);

    const scrollWidth = computedWidth;
    const chartW = Math.max(0, scrollWidth - padding.left - padding.right);
    const chartH = Math.max(0, height - padding.top - padding.bottom);

    const getY = (val: number) => {
        const pct = (val - minVal) / (maxVal - minVal);
        return chartH - (pct * chartH);
    };

    const getX = (index: number) => {
        const count = chartData.length;
        if (count <= 1) return chartW / 2;
        return (index / (count - 1)) * chartW;
    };
    
    const getPath = (metricKey: string, area: boolean = false) => {
        if (chartData.length === 0) return '';
        const points = chartData.map((d, i) => [getX(i), getY(d[metricKey] || 0)]);
        
        let path = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i][0]} ${points[i][1]}`;
        }
        
        if (area) {
            path += ` L ${points[points.length-1][0]} ${chartH} L ${points[0][0]} ${chartH} Z`;
        }
        return path;
    };

    const Icon = {
        'timeline': Calendar, 'bar': BarChart3, 'pie': PieChart, 
        'line': LineChart, 'area': Layers, 'donut': Circle, 'scatter': ScatterChart, 'kpi': Activity
    }[config.type] || BarChart3;

    return (
        <div 
            className={`bg-gray-900/40 border backdrop-blur-md rounded-2xl h-full flex flex-col relative overflow-hidden transition-all duration-300 group ${config.filters && Object.keys(config.filters).length > 0 ? 'border-violet-500/30' : 'border-white/5'}`}
            onMouseLeave={() => setHoverIndex(null)}
        >
            <div className="flex justify-between items-start p-4 pb-0 z-[40] shrink-0 w-full pointer-events-none">
                <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 flex-1 pointer-events-auto min-w-0 mr-2">
                    <Icon size={12} style={{ color: colors[0] }} className="shrink-0" />
                    <span className="truncate break-words">{config.title}</span>
                </h3>
                <div className="flex items-center gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {onEditFilters && (
                        <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onEditFilters(); }} 
                            className={`p-1.5 rounded-lg transition-colors ${config.filters && Object.keys(config.filters).length > 0 ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            title="Filter Widget"
                        >
                            <Filter size={14} fill={config.filters && Object.keys(config.filters).length > 0 ? "currentColor" : "none"} />
                        </button>
                    )}
                    {onEditSettings && (
                        <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onEditSettings(); }} 
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            title="Edit Settings"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                    {isLine && onConfigUpdate && (
                        <div className="relative" ref={timeMenuRef}>
                            <button 
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => setIsTimeMenuOpen(!isTimeMenuOpen)} 
                                className="flex items-center gap-1 text-[9px] font-bold uppercase text-gray-500 hover:text-white transition-colors bg-gray-950/50 px-2 py-1.5 rounded-lg border border-white/5"
                            >
                                {config.timeGrain || 'Auto'} <ChevronDown size={10} />
                            </button>
                            {isTimeMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-24 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[100]">
                                    {['auto', 'year', 'month', 'week', 'day'].map(g => (
                                        <button key={g} onClick={() => { onConfigUpdate({...config, timeGrain: g as any}); setIsTimeMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] uppercase font-bold hover:bg-gray-800 text-gray-400">{g}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Legend for Multi-Series (Non-Pie) */}
            {metrics.length > 1 && !isPie && (
                <div className="flex flex-wrap gap-3 px-4 pt-2 z-30 pointer-events-auto justify-center">
                    {metrics.map((m, i) => (
                        <div key={m} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></span>
                            <span className="text-[10px] font-bold text-gray-400">{m}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters Tags */}
            {config.filters && Object.keys(config.filters).length > 0 && (
                <div className="flex flex-wrap gap-1 px-4 pt-2 z-30 pointer-events-auto">
                    {Object.entries(config.filters).map(([key, filter]) => {
                        const label = getFilterLabel(filter);
                        if (label === 'All') return null;
                        return (
                            <button 
                                key={key} 
                                onClick={onEditFilters}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[9px] font-bold hover:bg-violet-500/20 transition-colors"
                            >
                                <span className="opacity-70">{key}:</span> {label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 w-full min-h-0 relative flex flex-col" ref={containerRef}>
                {width > 0 && height > 0 && (
                    <>
                    <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
                        <svg width={scrollWidth} height={height} className="overflow-visible block">
                            <defs>
                                <linearGradient id={`grad-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={colors[0]} stopOpacity={0.4}/>
                                    <stop offset="100%" stopColor={colors[0]} stopOpacity={0}/>
                                </linearGradient>
                            </defs>

                            {isPie ? (
                                <g transform={`translate(${width/2}, ${(height)/2})`}>
                                    {(() => {
                                        const radius = Math.min(width, height) / 2 - 20; // Leave margin
                                        let startAngle = 0;
                                        
                                        return chartData.map((d, i) => {
                                            const val = d[metrics[0]] || 0;
                                            const sliceAngle = (val / totalValue) * 2 * Math.PI;
                                            const endAngle = startAngle + sliceAngle;
                                            const x1 = Math.cos(startAngle) * radius;
                                            const y1 = Math.sin(startAngle) * radius;
                                            const x2 = Math.cos(endAngle) * radius;
                                            const y2 = Math.sin(endAngle) * radius;
                                            const largeArc = sliceAngle > Math.PI ? 1 : 0;
                                            const innerR = config.type === 'donut' ? radius * 0.6 : 0;
                                            const x1_in = Math.cos(startAngle) * innerR;
                                            const y1_in = Math.sin(startAngle) * innerR;
                                            const x2_in = Math.cos(endAngle) * innerR;
                                            const y2_in = Math.sin(endAngle) * innerR;

                                            const dPath = config.type === 'donut' 
                                                ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x2_in} ${y2_in} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`
                                                : `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                                            // Label Calculation
                                            const midAngle = startAngle + sliceAngle / 2;
                                            const labelRadius = config.type === 'donut' ? radius * 0.8 : radius * 0.65;
                                            const lx = Math.cos(midAngle) * labelRadius;
                                            const ly = Math.sin(midAngle) * labelRadius;
                                            const showLabel = sliceAngle > 0.2; // Only label big slices
                                            const percentage = ((val / totalValue) * 100).toFixed(1) + '%';

                                            startAngle = endAngle;
                                            const c = colors[i % colors.length];
                                            
                                            return (
                                                <g key={i} onMouseEnter={() => setHoverIndex(i)}>
                                                    <path 
                                                        d={dPath} 
                                                        fill={c} 
                                                        stroke="#111827" 
                                                        strokeWidth="2" 
                                                        className="opacity-90 hover:opacity-100 transition-opacity" 
                                                        style={{ transform: hoverIndex === i ? 'scale(1.05)' : 'scale(1)', transformOrigin: 'center', transition: 'transform 0.2s' }}
                                                    />
                                                    {showLabel && (
                                                        <text 
                                                            x={lx} y={ly} 
                                                            textAnchor="middle" 
                                                            dy="0.35em" 
                                                            fill="white" 
                                                            fontSize="10" 
                                                            fontWeight="bold" 
                                                            className="pointer-events-none drop-shadow-md shadow-black"
                                                            style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
                                                        >
                                                            {percentage}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        });
                                    })()}
                                    {hoverIndex !== null && chartData[hoverIndex] && config.type === 'donut' && (
                                        <g>
                                            <text textAnchor="middle" dy="-0.5em" fill="gray" fontSize="10" fontWeight="normal" className="pointer-events-none">
                                                {chartData[hoverIndex].name}
                                            </text>
                                            <text textAnchor="middle" dy="1em" fill="white" fontSize="14" fontWeight="bold" className="pointer-events-none">
                                                {formatValue(chartData[hoverIndex][metrics[0]])}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            ) : (
                                <g transform={`translate(${padding.left}, ${padding.top})`}>
                                    {yTicks.map((tick, i) => (
                                        <g key={i} transform={`translate(0, ${getY(tick)})`}>
                                            <line x1={0} y1={0} x2={chartW} y2={0} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
                                            <text x={-10} y={0} dy="0.32em" textAnchor="end" fill="#6b7280" fontSize="9" fontFamily="monospace">
                                                {formatValue(tick)}
                                            </text>
                                        </g>
                                    ))}

                                    <line x1={0} y1={0} x2={0} y2={chartH} stroke="#4b5563" strokeWidth="1" />
                                    <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#4b5563" strokeWidth="1" />

                                    {config.yAxisLabel && (
                                        <text transform={`rotate(-90)`} x={-chartH / 2} y={-40} textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold" letterSpacing="1px">
                                            {config.yAxisLabel.toUpperCase()}
                                        </text>
                                    )}
                                    {config.xAxisLabel && (
                                        <text x={chartW / 2} y={chartH + 35} textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold" letterSpacing="1px">
                                            {config.xAxisLabel.toUpperCase()}
                                        </text>
                                    )}

                                    {chartData.map((d, i) => {
                                        const labelW = isLine || config.type === 'timeline' ? 80 : 40; 
                                        const maxLabels = Math.floor(chartW / labelW);
                                        const step = Math.ceil(chartData.length / maxLabels);
                                        if (i % step !== 0 && chartData.length > maxLabels) return null;
                                        const xPos = isBar 
                                            ? (i * (chartW / chartData.length)) + (chartW / chartData.length) / 2
                                            : getX(i);
                                        return (
                                            <text key={i} x={xPos} y={chartH + 15} textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">
                                                {d.name && d.name.length > 12 ? d.name.substring(0,10)+'..' : d.name}
                                            </text>
                                        );
                                    })}

                                    {isBar && chartData.map((d, i) => {
                                        const groupWidth = (chartW / chartData.length);
                                        const barWidth = (groupWidth * 0.8) / metrics.length;
                                        const groupX = (i * groupWidth) + (groupWidth * 0.1);

                                        return (
                                            <g key={i}>
                                                {metrics.map((metric, mIdx) => {
                                                    const val = d[metric] || 0;
                                                    const y = getY(val);
                                                    const h = Math.max(0, chartH - y);
                                                    const col = (metrics.length === 1 && colors.length > 1) 
                                                        ? colors[i % colors.length] 
                                                        : colors[mIdx % colors.length];
                                                    const barX = groupX + (mIdx * barWidth);

                                                    return (
                                                        <g key={`${i}-${mIdx}`}>
                                                            <rect 
                                                                x={barX} y={y} width={barWidth} height={h} 
                                                                fill={col} rx="2" 
                                                                className="opacity-80 hover:opacity-100 transition-opacity cursor-crosshair"
                                                                onMouseEnter={() => setHoverIndex(i)}
                                                            />
                                                            {barWidth > 20 && h > 15 && (
                                                                <text 
                                                                    x={barX + barWidth / 2} 
                                                                    y={y - 5} 
                                                                    textAnchor="middle" 
                                                                    fill="white" 
                                                                    fontSize="9" 
                                                                    fontWeight="bold"
                                                                    className="drop-shadow-md pointer-events-none"
                                                                >
                                                                    {formatValue(val)}
                                                                </text>
                                                            )}
                                                        </g>
                                                    );
                                                })}
                                            </g>
                                        );
                                    })}

                                    {isLine && metrics.map((metric, mIdx) => {
                                        const col = colors[mIdx % colors.length];
                                        return (
                                            <g key={metric}>
                                                {(config.type === 'area' || config.type === 'timeline') && (
                                                    <path d={getPath(metric, true)} fill={col} fillOpacity={0.1} stroke="none" />
                                                )}
                                                <path d={getPath(metric, false)} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                {chartData.map((d, i) => {
                                                    const cx = getX(i);
                                                    const cy = getY(d[metric] || 0);
                                                    const sliceW = chartW / chartData.length;
                                                    return (
                                                        <g key={i} onMouseEnter={() => setHoverIndex(i)}>
                                                            <circle cx={cx} cy={cy} r="3" fill={col} stroke="#111827" strokeWidth="1" className="transition-transform hover:scale-150" />
                                                            <rect x={cx - sliceW/2} y={0} width={sliceW} height={chartH} fill="transparent" className="cursor-crosshair" />
                                                        </g>
                                                    );
                                                })}
                                            </g>
                                        );
                                    })}

                                    {hoverIndex !== null && chartData[hoverIndex] && (
                                        <g pointerEvents="none">
                                            {isBar ? (
                                                (() => {
                                                    const d = chartData[hoverIndex];
                                                    const groupWidth = (chartW / chartData.length);
                                                    const x = (hoverIndex * groupWidth) + (groupWidth / 2);
                                                    const maxValInGroup = Math.max(...metrics.map(m => d[m] || 0));
                                                    const y = getY(maxValInGroup);
                                                    
                                                    return (
                                                        <g transform={`translate(${x}, ${y - 30})`}>
                                                            <rect x="-60" y="-20" width="120" height={20 + (metrics.length * 15)} rx="4" fill="#111827" fillOpacity="0.95" stroke="#374151" />
                                                            <text textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" y="-5">{d.name}</text>
                                                            {metrics.map((m, idx) => {
                                                                const col = (metrics.length === 1 && colors.length > 1) ? colors[hoverIndex % colors.length] : colors[idx % colors.length];
                                                                return (
                                                                    <text key={m} x="-50" y={10 + (idx * 15)} fill={col} fontSize="10" fontWeight="bold" textAnchor="start">
                                                                        {m}: {formatValue(d[m] || 0)}
                                                                    </text>
                                                                );
                                                            })}
                                                        </g>
                                                    );
                                                })()
                                            ) : (
                                                (() => {
                                                    const d = chartData[hoverIndex];
                                                    const x = getX(hoverIndex);
                                                    const y = getY(d[metrics[0]] || 0);
                                                    
                                                    return (
                                                        <>
                                                            <line x1={x} y1={0} x2={x} y2={chartH} stroke="#ffffff" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                                                            {metrics.map((m, idx) => (
                                                                <circle key={m} cx={x} cy={getY(d[m] || 0)} r="5" fill={colors[idx % colors.length]} stroke="white" strokeWidth="2" />
                                                            ))}
                                                            <g transform={`translate(${x < chartW / 2 ? x + 10 : x - 130}, ${Math.max(20, y - 40)})`}>
                                                                <rect x="0" y="0" width="120" height={30 + (metrics.length * 15)} rx="6" fill="#111827" stroke="#374151" fillOpacity="0.95" />
                                                                <text x="10" y="20" fill="#9ca3af" fontSize="10" fontWeight="bold">{d.name}</text>
                                                                {metrics.map((m, idx) => (
                                                                    <text key={m} x="10" y={35 + (idx * 15)} fill={colors[idx % colors.length]} fontSize="11" fontWeight="bold">
                                                                        {m}: {formatValue(d[m] || 0)}
                                                                    </text>
                                                                ))}
                                                            </g>
                                                        </>
                                                    );
                                                })()
                                            )}
                                        </g>
                                    )}
                                </g>
                            )}
                        </svg>
                    </div>
                    {/* LEGEND SECTION FOR PIE CHARTS */}
                    {isPie && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center px-4 py-2 border-t border-white/5 bg-black/20 max-h-32 overflow-y-auto custom-scrollbar">
                            {chartData.map((d, i) => {
                                const val = d[metrics[0]] || 0;
                                const pct = ((val / totalValue) * 100).toFixed(1) + '%';
                                return (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px] whitespace-nowrap" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></span>
                                        <span className={`font-medium ${hoverIndex === i ? 'text-white' : 'text-gray-400'}`}>{d.name}</span>
                                        <span className="text-gray-500 font-mono">
                                            {formatValue(val)} <span className="opacity-50">({pct})</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </>
                )}
            </div>
        </div>
    );
};
