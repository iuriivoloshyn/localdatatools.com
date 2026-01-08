
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { 
    LayoutDashboard, FilterX, Maximize2, Minimize2, 
    BarChart3, Calendar, X, MoreHorizontal,
    Activity, PieChart, Download, Settings, Plus,
    Trash2, Save, Move, GripHorizontal, ChevronDown,
    Clock, AlignLeft, ZoomIn, ZoomOut, RotateCcw, Hand, Grip, LayoutTemplate,
    Pencil, Scaling, Magnet, Edit3, Grid, Layers,
    FileJson, Upload as UploadIcon, FolderOpen, Filter, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../../App';
import { parseCSVLine, detectDelimiter } from '../../utils/csvHelpers';
import { analyzeColumns, generateWidgets, aggregateData as baseAggregateData, WidgetConfig, ColumnAnalysis } from '../../utils/dashboardHelpers';
import html2canvas from 'html2canvas';

const NEON_PALETTE = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6'];
const DEFAULT_GAP = 24;

// --- Types ---
interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    zIndex: number;
}

interface ExtendedWidgetConfig extends WidgetConfig {
    timeGrain?: 'auto' | 'day' | 'week' | 'month' | 'year';
    layout: WidgetLayout;
}

interface SnapLine {
    orientation: 'vertical' | 'horizontal';
    position: number;
    start: number;
    end: number;
    type?: 'gap' | 'align'; // Distinguish visual style
}

interface DashboardSpace {
    id: string;
    name: string;
    widgets: ExtendedWidgetConfig[];
    filters: Record<string, string>;
}

interface DashboardConfig {
    version: number;
    spaces: DashboardSpace[];
}

// --- Helpers ---
const formatDateKey = (val: any, grain: string) => {
    let d: Date;
    if (val instanceof Date) d = val;
    else {
        d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
    }
    
    if (grain === 'year') return `${d.getFullYear()}`;
    if (grain === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (grain === 'week') {
        const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = dCopy.getUTCDay() || 7;
        dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${dCopy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }
    if (grain === 'day') return d.toISOString().split('T')[0];
    return String(val);
};

const aggregateDataWithGrain = (data: any[], config: ExtendedWidgetConfig, filters: Record<string, any>) => {
    const filtered = data.filter(row => {
        for (const [key, val] of Object.entries(filters)) {
            let rowVal = row[key];
            if (rowVal !== val) return false; 
        }
        return true;
    });

    if (config.type === 'kpi') {
        if (config.aggregation === 'sum') {
            return filtered.reduce((acc, r) => acc + (Number(r[config.dataKey]) || 0), 0);
        }
        if (config.aggregation === 'avg') {
            const sum = filtered.reduce((acc, r) => acc + (Number(r[config.dataKey]) || 0), 0);
            return sum / (filtered.length || 1);
        }
        return filtered.length;
    }

    if (config.type === 'bar' || config.type === 'timeline' || config.type === 'pie') {
        const counts: Record<string, number> = {};
        
        filtered.forEach(row => {
            let val = row[config.dataKey];
            if (val === undefined || val === null || String(val).trim() === '') return;

            if (config.type === 'timeline') {
                const grain = config.timeGrain || 'auto';
                if (grain !== 'auto') {
                    val = formatDateKey(val, grain);
                } else {
                    try {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) val = d.toISOString().split('T')[0];
                    } catch(e) {}
                }
            } else {
                val = String(val);
            }

            if (config.aggregation === 'sum' && config.secondaryKey) {
                counts[val] = (counts[val] || 0) + (Number(row[config.secondaryKey]) || 0);
            } else if (config.aggregation === 'avg' && config.secondaryKey) {
                counts[val] = (counts[val] || 0) + (Number(row[config.secondaryKey]) || 0);
            } else {
                counts[val] = (counts[val] || 0) + 1;
            }
        });

        let results = Object.entries(counts).map(([name, value]) => ({ name, value }));

        if (config.type === 'timeline') {
            results.sort((a, b) => {
                const dateA = new Date(a.name).getTime();
                const dateB = new Date(b.name).getTime();
                if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
                return a.name.localeCompare(b.name);
            });
            
            if (config.timeGrain === 'auto' && results.length > 60) {
                const monthCounts: Record<string, number> = {};
                results.forEach(r => {
                    const month = r.name.substring(0, 7); 
                    monthCounts[month] = (monthCounts[month] || 0) + r.value;
                });
                results = Object.entries(monthCounts).map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
            }
        } else {
            results.sort((a, b) => b.value - a.value);
            if (results.length > 20) results = results.slice(0, 20);
        }

        return results;
    }
    return [];
};

// --- Components ---

const WidgetEditor = ({ 
    widget, 
    columns, 
    onSave, 
    onCancel, 
    onDelete 
}: { 
    widget: ExtendedWidgetConfig, 
    columns: ColumnAnalysis[], 
    onSave: (w: ExtendedWidgetConfig) => void, 
    onCancel: () => void, 
    onDelete: () => void 
}) => {
    const [config, setConfig] = useState({ ...widget });

    return (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onPointerDown={e => e.stopPropagation()}>
            <div className="bg-[#111827] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Edit3 size={18} className="text-violet-400" />
                        Edit Widget
                    </h3>
                    <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Title (Display Name)</label>
                        <input 
                            type="text" 
                            value={config.title} 
                            onChange={(e) => setConfig({ ...config, title: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                            placeholder="e.g. Total Sales, User Growth..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visualization</label>
                        <div className="grid grid-cols-4 gap-2">
                            {['kpi', 'bar', 'timeline', 'pie'].map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setConfig({ ...config, type: type as any })}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${config.type === type ? 'bg-violet-600 border-violet-500 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {type === 'kpi' && <Activity size={20} />}
                                    {type === 'bar' && <BarChart3 size={20} />}
                                    {type === 'timeline' && <Calendar size={20} />}
                                    {type === 'pie' && <PieChart size={20} />}
                                    <span className="text-[10px] uppercase font-bold mt-1">{type}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {config.type === 'kpi' ? 'Metric Column' : 'Group By (X-Axis)'}
                            </label>
                            <select 
                                value={config.dataKey}
                                onChange={(e) => setConfig({ ...config, dataKey: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                            >
                                {columns.map(c => (
                                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operation</label>
                            <select 
                                value={config.aggregation}
                                onChange={(e) => setConfig({ ...config, aggregation: e.target.value as any })}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                            >
                                <option value="count">Count Rows</option>
                                <option value="sum">Sum Value</option>
                                <option value="avg">Average</option>
                            </select>
                        </div>
                    </div>

                    {config.type === 'timeline' && (
                        <div className="space-y-1 animate-in fade-in">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Clock size={12} /> Date Grouping
                            </label>
                            <div className="grid grid-cols-5 gap-1">
                                {['auto', 'day', 'week', 'month', 'year'].map(g => (
                                    <button 
                                        key={g}
                                        onClick={() => setConfig({ ...config, timeGrain: g as any })}
                                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${config.timeGrain === g || (!config.timeGrain && g === 'auto') ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                    >
                                        {g.charAt(0).toUpperCase() + g.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
                    <button onClick={onDelete} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
                        <Trash2 size={16} /> Delete
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
                        <button onClick={() => onSave(config)} className="px-6 py-2 rounded-lg text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg transition-all flex items-center gap-2">
                            <Save size={16} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const KpiWidget = ({ config, value, onClick }: { config: ExtendedWidgetConfig, value: number, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className={`bg-gray-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-center items-center text-center h-full group relative overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-violet-500/30 hover:bg-gray-900/60' : ''}`}
    >
        <div className="z-10 relative flex flex-col items-center justify-center w-full h-full">
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center justify-center gap-2 truncate w-full">
                <Activity size={12} className="text-cyan-400 shrink-0" />
                <span className="truncate">{config.title}</span>
            </h3>
            <div className="text-3xl md:text-4xl font-black text-white tracking-tight truncate mt-2">
                {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
        </div>
    </div>
);

// Removed filtering interaction from charts as requested
const ChartWidget = ({ config, data, isActiveFilter }: { config: ExtendedWidgetConfig, data: any[], isActiveFilter: boolean }) => {
    const color = NEON_PALETTE[Math.abs(config.title.length) % NEON_PALETTE.length];
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const totalVal = data.reduce((a, b) => a + b.value, 0);

    return (
        <div 
            className={`bg-gray-900/40 border backdrop-blur-md rounded-2xl p-5 h-full flex flex-col relative overflow-hidden transition-all duration-300 ${isActiveFilter ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-white/5'}`}
        >
            <div className="flex justify-center items-start mb-2 z-10 shrink-0 w-full">
                <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 truncate w-full">
                    {config.type === 'timeline' ? <Calendar size={12} style={{ color }}/> : 
                     config.type === 'pie' ? <PieChart size={12} style={{ color }}/> :
                     <BarChart3 size={12} style={{ color }}/>}
                    <span className="truncate">{config.title}</span>
                </h3>
            </div>
            
            <div className="flex-1 w-full min-h-0 z-10 flex flex-col relative group overflow-hidden pointer-events-none">
                {data.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-600 text-xs italic">No data</div>
                ) : config.type === 'pie' ? (
                    <div className="flex flex-col h-full w-full">
                        {/* Pie Graphic - Adjusted height to fit legend */}
                        <div className="flex-1 w-full flex items-center justify-center min-h-0 relative">
                            <svg viewBox="0 0 100 100" className="w-full h-full max-h-[140px] overflow-visible transform -rotate-90">
                                {(() => {
                                    let accumulatedPercent = 0;
                                    return data.map((d, i) => {
                                        const percent = d.value / (totalVal || 1);
                                        const dashArray = `${percent * 100} 100`;
                                        const dashOffset = -accumulatedPercent * 100;
                                        accumulatedPercent += percent;
                                        const sliceColor = NEON_PALETTE[i % NEON_PALETTE.length];
                                        
                                        return (
                                            <circle 
                                                key={i}
                                                r="15.9155" cx="50" cy="50" 
                                                fill="transparent"
                                                stroke={sliceColor}
                                                strokeWidth="32" 
                                                strokeDasharray={dashArray}
                                                strokeDashoffset={dashOffset}
                                                className="opacity-80"
                                            >
                                                <title>{d.name}: {d.value.toLocaleString()} ({Math.round(percent * 100)}%)</title>
                                            </circle>
                                        );
                                    });
                                })()}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-bold text-white">{totalVal.toLocaleString()}</span>
                                <span className="text-[8px] text-gray-500 uppercase tracking-wider">Total</span>
                            </div>
                        </div>
                        
                        {/* Scrollable Legend */}
                        <div className="h-[30%] min-h-[60px] w-full overflow-y-auto custom-scrollbar border-t border-white/5 mt-2 pt-2 pointer-events-auto">
                            <div className="space-y-1">
                                {data.map((d, i) => {
                                    const percent = (d.value / (totalVal || 1)) * 100;
                                    const color = NEON_PALETTE[i % NEON_PALETTE.length];
                                    return (
                                        <div 
                                            key={i} 
                                            className="flex items-center justify-between text-[10px] px-2 py-1 rounded"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                                                <span className="truncate font-medium text-gray-400">{d.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-gray-300 font-mono">{d.value.toLocaleString()}</span>
                                                <span className="text-gray-500 w-8 text-right">{Math.round(percent)}%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : config.type === 'timeline' ? (
                    <div className="relative w-full h-full flex flex-col justify-center">
                       <div className="flex-1 w-full relative flex items-center">
                           <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                               <defs>
                                   <linearGradient id={`grad-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor={color} stopOpacity={0.5}/>
                                       <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               {(() => {
                                   if(data.length < 1) return null;
                                   const pts = data.map((d, i) => {
                                       const count = data.length > 1 ? data.length - 1 : 1;
                                       const x = (i / count) * 100;
                                       const y = 100 - ((d.value / maxVal) * 100); 
                                       return `${x} ${y}`;
                                   });
                                   // Handle single point logic for path drawing
                                   let dArea, dLine;
                                   if (data.length === 1) {
                                       const y = 100 - ((data[0].value / maxVal) * 100);
                                       dArea = `M 0 100 L 0 ${y} L 100 ${y} L 100 100 Z`;
                                       dLine = `M 0 ${y} L 100 ${y}`;
                                   } else {
                                       dArea = `M 0 100 L ${pts.join(' L ')} L 100 100 Z`;
                                       dLine = `M ${pts.join(' L ')}`;
                                   }
                                   return (
                                       <>
                                         <path d={dArea} fill={`url(#grad-${config.id})`} className="opacity-70" vectorEffect="non-scaling-stroke" />
                                         <path d={dLine} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                                       </>
                                   );
                               })()}
                           </svg>
                       </div>
                       
                       {/* Timeline X-Axis Labels */}
                       <div className="h-4 w-full flex justify-between text-[9px] text-gray-500 font-mono mt-1 pt-1 border-t border-white/5">
                           <span>{data[0]?.name}</span>
                           {data.length > 2 && <span>{data[Math.floor(data.length/2)]?.name}</span>}
                           {data.length > 1 && <span>{data[data.length-1]?.name}</span>}
                       </div>
                    </div>
                ) : (
                    // Bar Chart with Numbers
                    <div className="w-full h-full flex items-end justify-between gap-1 relative pt-4 pb-4">
                        {data.map((d, i) => {
                            const heightPct = (d.value / maxVal) * 100;
                            const barColor = data.length <= 5 ? NEON_PALETTE[i % NEON_PALETTE.length] : color;
                            
                            return (
                                <div 
                                    key={i} 
                                    className="chart-element flex-1 flex flex-col justify-end group relative h-full min-w-[12px]"
                                >
                                    <div 
                                        className="text-[9px] text-gray-300 font-bold text-center mb-1 whitespace-nowrap absolute bottom-full left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                                        style={{ bottom: `${Math.max(heightPct, 0)}%`, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                    >
                                        {d.value.toLocaleString()}
                                    </div>
                                    
                                    <div 
                                        className="w-full rounded-t-sm transition-all duration-300 relative mx-[1px] opacity-80"
                                        style={{ 
                                            height: `${Math.max(heightPct, 2)}%`, 
                                            backgroundColor: barColor
                                        }}
                                    />
                                    {/* X-Axis Label - Rotated if dense */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-0 h-0 flex justify-center overflow-visible z-10">
                                        <span className={`text-[8px] text-gray-500 whitespace-nowrap origin-top-left transition-all ${data.length > 8 ? 'rotate-45 translate-x-1 translate-y-1' : ''}`}>
                                            {d.name}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const InstantDashboardTool: React.FC = () => {
  const { t } = useLanguage();
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnAnalysis[]>([]);
  const [spaces, setSpaces] = useState<DashboardSpace[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [defaultWidgets, setDefaultWidgets] = useState<ExtendedWidgetConfig[]>([]); 
  
  const [isPresentation, setIsPresentation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [renamingSpaceId, setRenamingSpaceId] = useState<string | null>(null);

  // Layout Loading
  const configInputRef = useRef<HTMLInputElement>(null);

  // Filter UI State
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [pendingFilterCol, setPendingFilterCol] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Pan/Zoom State - Start with 0.75 for non-fullscreen mode default
  const [panZoom, setPanZoom] = useState({ x: 0, y: 0, scale: 0.75 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // New state for dashboard drop
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });

  // Drag & Resize State (Free Movement)
  const [interactingWidgetId, setInteractingWidgetId] = useState<string | null>(null);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]); // New Snap State
  const snapTargetRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const interactionRef = useRef<{
      type: 'drag' | 'resize';
      startX: number;
      startY: number;
      initialX: number;
      initialY: number;
      initialW: number;
      initialH: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevWidgetsLen = useRef(0);

  // Derived state for current space
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const widgets = activeSpace ? activeSpace.widgets : [];
  const activeFilters = activeSpace ? activeSpace.filters : {};

  // Close filter menu on outside click
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
              setShowFilterMenu(false);
              setPendingFilterCol(null);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to update active space safely
  const updateActiveSpace = (updater: (space: DashboardSpace) => DashboardSpace) => {
      setSpaces(prev => prev.map(s => s.id === activeSpaceId ? updater(s) : s));
  };

  // Calculate content bounds helper
  const getContentBounds = useCallback(() => {
      if (widgets.length === 0) return { minX: 0, minY: 0, width: 0, height: 0, maxX: 0, maxY: 0 };
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      widgets.forEach(w => {
          minX = Math.min(minX, w.layout.x);
          minY = Math.min(minY, w.layout.y);
          maxX = Math.max(maxX, w.layout.x + w.layout.w);
          maxY = Math.max(maxY, w.layout.y + w.layout.h);
      });
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [widgets]);

  // Center View Logic
  const centerView = useCallback((targetScale?: number, forceDefaultMode: boolean = false) => {
      if (!containerRef.current || widgets.length === 0) return;
      
      const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect();
      const { minX, minY, width: contentW } = getContentBounds();
      
      if (forceDefaultMode) {
          // Default Mode: Fit width (max 0.75 for non-fullscreen comfort), align top-center
          const padding = 40;
          // User requested 75% default zoom to avoid "too big" feel
          let fitScale = Math.min(0.75, (containerW - padding * 2) / contentW);
          
          // Clamp scale to ensure text is readable
          if (fitScale < 0.3) fitScale = 0.3;

          // Center horizontally
          const centerX = (containerW - contentW * fitScale) / 2;
          const newX = centerX - minX * fitScale;
          
          // Top align with padding
          const newY = padding - (minY * fitScale);

          setPanZoom({ x: newX, y: newY, scale: fitScale });
      } else {
          // Presentation Mode
          const padding = 50;
          let fitScale = targetScale;
          const { height: contentH, contentCenterY } = (() => {
              const { maxY, minY: _minY } = getContentBounds();
              return { height: maxY - _minY, contentCenterY: _minY + (maxY - _minY) / 2 };
          })();
          const contentCenterX = minX + contentW / 2;

          if (!fitScale) {
              const scaleX = (containerW - padding * 2) / contentW;
              const scaleY = (containerH - padding * 2) / contentH;
              fitScale = Math.min(scaleX, scaleY, 1);
          }
          
          const newX = (containerW / 2) - (contentCenterX * fitScale);
          const newY = (containerH / 2) - (contentCenterY * fitScale);

          setPanZoom({ x: newX, y: newY, scale: fitScale });
      }
  }, [widgets, getContentBounds]);

  // Handle Initial Load Centering
  useEffect(() => {
      // Trigger when widgets populate from empty (File Load)
      if (prevWidgetsLen.current === 0 && widgets.length > 0) {
          // Wait for DOM layout
          setTimeout(() => centerView(undefined, true), 100);
      }
      prevWidgetsLen.current = widgets.length;
  }, [widgets, centerView]);

  // Re-center when switching spaces
  useEffect(() => {
      if (activeSpaceId && widgets.length > 0) {
          setTimeout(() => centerView(undefined, !isPresentation), 50);
      }
  }, [activeSpaceId]);

  useEffect(() => {
      const handleEsc = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && isPresentation) setIsPresentation(false);
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
  }, [isPresentation]);

  useEffect(() => {
      if (isPresentation) {
          // Switch to Presentation Mode: Set 75% zoom by default
          requestAnimationFrame(() => centerView(0.75));
      } else {
          // Switch to Default Mode: Fit Width, Standard View
          // We check if widgets exist to prevent centering empty state
          if (widgets.length > 0) {
              requestAnimationFrame(() => centerView(undefined, true));
          }
      }
  }, [isPresentation, centerView, widgets.length]);

  // Initial Layout Generator
  const calculateInitialLayout = (baseWidgets: WidgetConfig[]): ExtendedWidgetConfig[] => {
      let x = 0;
      let y = 0;
      let rowHeight = 0;
      const containerWidth = 1400; // Virtual container width for initial wrapping
      const cellW = 320; // Base cell width
      const cellH = 320; // Base cell height

      const result = baseWidgets.map((w, i) => {
          let width = cellW;
          let height = cellH;
          
          if (w.colSpan === 2) width = (cellW * 2) + DEFAULT_GAP;
          else if (w.colSpan === 4) width = (cellW * 4) + (DEFAULT_GAP * 3);
          
          if (w.type === 'kpi') height = 180;

          if (x + width > containerWidth && x > 0) {
              x = 0;
              y += rowHeight + DEFAULT_GAP;
              rowHeight = 0;
          }

          const layout: WidgetLayout = {
              x,
              y,
              w: width,
              h: height,
              zIndex: 1
          };

          rowHeight = Math.max(rowHeight, height);
          x += width + DEFAULT_GAP;
          
          return { ...w, layout } as ExtendedWidgetConfig;
      });

      return result;
  };

  const handleFile = async (fileData: any) => {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 50));
      try {
          const text = await fileData.file.text();
          const delimiter = detectDelimiter(text);
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length === 0) throw new Error("Empty file");
          
          const headers = parseCSVLine(lines[0], delimiter);
          const dataRows = lines.slice(1, 50001).map(l => {
              const vals = parseCSVLine(l, delimiter);
              const obj: any = {};
              headers.forEach((h, i) => {
                  const cleanHeader = h.trim();
                  if (cleanHeader) obj[cleanHeader] = vals[i];
              });
              return obj;
          });

          const cleanHeaders = headers.map(h => h.trim()).filter(Boolean);
          const analysis = analyzeColumns(dataRows, cleanHeaders);
          
          setRawData(dataRows);
          setColumns(analysis);
          
          // Only generate default layout if none exists
          if (spaces.length === 0) {
              const baseWidgets = generateWidgets(analysis);
              const positionedWidgets = calculateInitialLayout(baseWidgets);
              
              const initialSpace: DashboardSpace = {
                  id: 'overview',
                  name: 'Overview',
                  widgets: positionedWidgets,
                  filters: {}
              };
              setSpaces([initialSpace]);
              setActiveSpaceId('overview');
              setDefaultWidgets(JSON.parse(JSON.stringify(positionedWidgets)));
          }
      } catch (e) {
          console.error("Dashboard processing failed", e);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDashboardDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && files[0].name.toLowerCase().endsWith('.csv')) {
          await handleFile({ file: files[0] });
      }
  };

  const handleResetLayout = () => {
      if (!activeSpaceId) return;
      updateActiveSpace(s => ({ ...s, widgets: JSON.parse(JSON.stringify(defaultWidgets)) }));
      setTimeout(() => centerView(undefined, !isPresentation), 50);
  };

  const handleFilter = (key: string, value: string) => {
      if (!activeSpaceId) return; 
      updateActiveSpace(s => {
          const newFilters = { ...s.filters };
          if (newFilters[key] === value) {
              delete newFilters[key];
          } else {
              newFilters[key] = value;
          }
          return { ...s, filters: newFilters };
      });
      // Close menus
      setShowFilterMenu(false);
      setPendingFilterCol(null);
  };

  const resetFilters = () => {
      if (!activeSpaceId) return;
      updateActiveSpace(s => ({ ...s, filters: {} }));
  };

  const getWidgetData = (config: ExtendedWidgetConfig) => {
      const contextFilters = { ...activeFilters };
      // Filter logic: Charts should reflect global filters, including their own key if set elsewhere.
      // Standard behavior: Filtering 'Category=A' should make the 'Category' chart show only 'A'.
      // If we remove the filter for the widget's own key, we get "Cross-Filtering" behavior (showing all options, highlighting selected).
      // Since we moved to Dropdown filtering, we should probably APPLY the filter to the chart to see the drill-down effect.
      // BUT, to allow users to see distribution of the filtered set, we normally apply all filters.
      return aggregateDataWithGrain(rawData, config, contextFilters);
  };

  const handleSaveWidget = (updatedWidget: ExtendedWidgetConfig) => {
      if (!activeSpaceId) return;
      if (editingWidgetId === 'new') {
          // Center new widget in view based on current panZoom
          const viewCenterX = (window.innerWidth / 2 - panZoom.x) / panZoom.scale - 150;
          const viewCenterY = (window.innerHeight / 2 - panZoom.y) / panZoom.scale - 150;
          
          updateActiveSpace(s => ({
              ...s,
              widgets: [...s.widgets, { 
                  ...updatedWidget, 
                  id: Math.random().toString(36).substr(2, 9),
                  layout: { x: viewCenterX, y: viewCenterY, w: 300, h: 300, zIndex: 10 } 
              }]
          }));
      } else {
          updateActiveSpace(s => ({
              ...s,
              widgets: s.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w)
          }));
      }
      setEditingWidgetId(null);
  };

  const handleDeleteWidget = () => {
      if (!activeSpaceId) return;
      updateActiveSpace(s => ({
          ...s,
          widgets: s.widgets.filter(w => w.id !== editingWidgetId)
      }));
      setEditingWidgetId(null);
  };

  const handleAddWidget = () => {
      const defaultCol = columns.length > 0 ? columns[0] : { name: 'Column', type: 'text' };
      // Note: Actual addition handled in SaveWidget
      const newWidget: ExtendedWidgetConfig = {
          id: 'new',
          title: 'New Chart',
          type: 'bar',
          dataKey: defaultCol.name,
          aggregation: 'count',
          layout: { x: 0, y: 0, w: 320, h: 320, zIndex: 1 }
      };
      setEditingWidgetId('new');
  };

  // --- Space Management ---
  const handleAddSpace = () => {
      const newId = Math.random().toString(36).substr(2, 9);
      const newSpace: DashboardSpace = {
          id: newId,
          name: `Space ${spaces.length + 1}`,
          widgets: [], // Start Empty
          filters: {}
      };
      setSpaces(prev => [...prev, newSpace]);
      setActiveSpaceId(newId);
  };

  const handleRenameSpace = (id: string, newName: string) => {
      setSpaces(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleDeleteSpace = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (spaces.length <= 1) return;
      
      const idx = spaces.findIndex(s => s.id === id);
      const newSpaces = spaces.filter(s => s.id !== id);
      setSpaces(newSpaces);
      
      // If deleting active space, switch to adjacent
      if (activeSpaceId === id) {
          const nextIdx = Math.max(0, idx - 1);
          setActiveSpaceId(newSpaces[nextIdx].id);
      }
  };

  // --- Layout Save/Load ---
  const handleExportLayout = () => {
      const config: DashboardConfig = {
          version: 1,
          spaces: spaces
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard_layout.json';
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportLayout = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const config = JSON.parse(ev.target?.result as string) as DashboardConfig;
              if (config && Array.isArray(config.spaces)) {
                  setSpaces(config.spaces);
                  if (config.spaces.length > 0) setActiveSpaceId(config.spaces[0].id);
              } else {
                  alert("Invalid layout file format");
              }
          } catch (err) {
              alert("Failed to parse layout file");
          }
      };
      reader.readAsText(file);
      if (configInputRef.current) configInputRef.current.value = '';
  };

  // --- Interaction Handlers (Drag, Resize & Snapping) ---

  const handleInteractionStart = (e: React.PointerEvent, widgetId: string, type: 'drag' | 'resize') => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      
      const widget = widgets.find(w => w.id === widgetId);
      if (!widget) return;

      // Bring to front
      updateActiveSpace(s => ({
          ...s,
          widgets: s.widgets.map(w => w.id === widgetId ? { ...w, layout: { ...w.layout, zIndex: 100 } } : { ...w, layout: { ...w.layout, zIndex: 1 } })
      }));

      interactionRef.current = {
          type,
          startX: e.clientX,
          startY: e.clientY,
          initialX: widget.layout.x,
          initialY: widget.layout.y,
          initialW: widget.layout.w,
          initialH: widget.layout.h
      };
      setInteractingWidgetId(widgetId);
      snapTargetRef.current = null;
      
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const getSnapLines = (activeId: string, x: number, y: number, w: number, h: number) => {
      // Increase threshold slightly for easier "catch"
      const SNAP_THRESHOLD = 20 / panZoom.scale; 
      
      let bestDx: number | null = null;
      let bestDy: number | null = null;
      let linesX: SnapLine[] = [];
      let linesY: SnapLine[] = [];

      const activeRect = {
          left: x,
          right: x + w,
          top: y,
          bottom: y + h,
          centerX: x + w / 2,
          centerY: y + h / 2
      };

      widgets.forEach(other => {
          if (other.id === activeId) return;
          
          const target = {
              left: other.layout.x,
              right: other.layout.x + other.layout.w,
              top: other.layout.y,
              bottom: other.layout.y + other.layout.h,
              centerX: other.layout.x + other.layout.w / 2,
              centerY: other.layout.y + other.layout.h / 2
          };

          // --- HORIZONTAL SNAPPING (X-Axis) ---
          const checkX = (currentVal: number, targetVal: number, type: 'align' | 'gap' = 'align') => {
              const dist = targetVal - currentVal;
              if (Math.abs(dist) < SNAP_THRESHOLD) {
                  if (bestDx === null || Math.abs(dist) < Math.abs(bestDx)) {
                      bestDx = dist;
                      linesX = [{ orientation: 'vertical', position: targetVal, start: Math.min(activeRect.top, target.top) - 20, end: Math.max(activeRect.bottom, target.bottom) + 20, type }];
                  } else if (Math.abs(dist) === Math.abs(bestDx)) {
                      linesX.push({ orientation: 'vertical', position: targetVal, start: Math.min(activeRect.top, target.top) - 20, end: Math.max(activeRect.bottom, target.bottom) + 20, type });
                  }
              }
          };

          checkX(activeRect.left, target.left);
          checkX(activeRect.left, target.right);
          checkX(activeRect.right, target.left);
          checkX(activeRect.right, target.right);
          checkX(activeRect.centerX, target.centerX);
          checkX(activeRect.left, target.right + DEFAULT_GAP, 'gap');
          checkX(activeRect.right, target.left - DEFAULT_GAP, 'gap');

          // --- VERTICAL SNAPPING (Y-Axis) ---
          const checkY = (currentVal: number, targetVal: number, type: 'align' | 'gap' = 'align') => {
              const dist = targetVal - currentVal;
              if (Math.abs(dist) < SNAP_THRESHOLD) {
                  if (bestDy === null || Math.abs(dist) < Math.abs(bestDy)) {
                      bestDy = dist;
                      linesY = [{ orientation: 'horizontal', position: targetVal, start: Math.min(activeRect.left, target.left) - 20, end: Math.max(activeRect.right, target.right) + 20, type }];
                  } else if (Math.abs(dist) === Math.abs(bestDy)) {
                      linesY.push({ orientation: 'horizontal', position: targetVal, start: Math.min(activeRect.left, target.left) - 20, end: Math.max(activeRect.right, target.right) + 20, type });
                  }
              }
          };

          checkY(activeRect.top, target.top);
          checkY(activeRect.top, target.bottom);
          checkY(activeRect.bottom, target.top);
          checkY(activeRect.bottom, target.bottom);
          checkY(activeRect.centerY, target.centerY);
          checkY(activeRect.top, target.bottom + DEFAULT_GAP, 'gap');
          checkY(activeRect.bottom, target.top - DEFAULT_GAP, 'gap');
      });

      return { x: x + (bestDx || 0), y: y + (bestDy || 0), lines: [...linesX, ...linesY] };
  };

  const handleInteractionMove = (e: React.PointerEvent) => {
      if (!interactingWidgetId || !interactionRef.current) return;
      e.preventDefault();

      const { startX, startY, initialX, initialY, initialW, initialH, type } = interactionRef.current;
      
      const rawDx = (e.clientX - startX) / panZoom.scale;
      const rawDy = (e.clientY - startY) / panZoom.scale;

      let nextX = initialX + (type === 'drag' ? rawDx : 0);
      let nextY = initialY + (type === 'drag' ? rawDy : 0);
      let nextW = initialW + (type === 'resize' ? rawDx : 0);
      let nextH = initialH + (type === 'resize' ? rawDy : 0);

      if (type === 'resize') {
          nextW = Math.max(150, nextW);
          nextH = Math.max(150, nextH);
      }

      const { x: snappedX, y: snappedY, lines } = getSnapLines(interactingWidgetId, nextX, nextY, nextW, nextH);
      
      setSnapLines(lines);
      snapTargetRef.current = { x: snappedX, y: snappedY, w: nextW, h: nextH };

      updateActiveSpace(s => ({
          ...s,
          widgets: s.widgets.map(w => {
              if (w.id !== interactingWidgetId) return w;
              if (type === 'drag') {
                  return { ...w, layout: { ...w.layout, x: nextX, y: nextY } };
              } else {
                  return { ...w, layout: { ...w.layout, w: nextW, h: nextH } };
              }
          })
      }));
  };

  const handleInteractionEnd = (e: React.PointerEvent) => {
      if (interactingWidgetId) {
          e.preventDefault();
          
          if (snapTargetRef.current) {
              const { x, y, w, h } = snapTargetRef.current;
              const type = interactionRef.current?.type;

              updateActiveSpace(s => ({
                  ...s,
                  widgets: s.widgets.map(w => {
                      if (w.id !== interactingWidgetId) return w;
                      if (type === 'drag') {
                          return { ...w, layout: { ...w.layout, x, y } };
                      }
                      return w;
                  })
              }));
          }

          setInteractingWidgetId(null);
          setSnapLines([]);
          snapTargetRef.current = null;
          interactionRef.current = null;
      }
  };

  // Canvas Panning & Zooming
  const handleWheel = (e: React.WheelEvent) => {
      if (isPresentation) {
          e.preventDefault();
          e.stopPropagation();
          if (!containerRef.current) return;
          const { width, height } = containerRef.current.getBoundingClientRect();
          
          // Unified Zoom Logic (Mouse Wheel + Trackpad)
          // Sensitivity tuning: 0.002 provides smooth 2-finger zoom on trackpads and reasonable wheel zoom
          const scaleSensitivity = 0.002;
          const delta = -e.deltaY * scaleSensitivity;
          
          const oldScale = panZoom.scale;
          const newScale = Math.min(Math.max(0.1, oldScale + delta), 5);
          
          // Zoom towards center of viewport (keeps content centered)
          const centerX = width / 2;
          const centerY = height / 2;
          const worldX = (centerX - panZoom.x) / oldScale;
          const worldY = (centerY - panZoom.y) / oldScale;
          const newX = centerX - worldX * newScale;
          const newY = centerY - worldY * newScale;
          
          setPanZoom({ x: newX, y: newY, scale: newScale });
      } else {
          if (e.ctrlKey) return; 
          const { maxY, minY } = getContentBounds();
          const { height: containerH } = containerRef.current?.getBoundingClientRect() || { height: 1000 };
          const topLimit = 40 - (minY * panZoom.scale);
          let bottomLimit = containerH - 40 - (maxY * panZoom.scale);
          if (bottomLimit > topLimit) bottomLimit = topLimit;
          const newY = Math.max(bottomLimit, Math.min(topLimit, panZoom.y - e.deltaY));
          setPanZoom(prev => ({ ...prev, y: newY }));
      }
  };

  const handlePanStart = (e: React.PointerEvent) => {
      if (!isPresentation) return;
      // Allow panning from anywhere in presentation mode
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panStartOffset.current = { x: panZoom.x, y: panZoom.y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handlePanMove = (e: React.PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanZoom(prev => ({ 
          ...prev, 
          x: panStartOffset.current.x + dx, 
          y: panStartOffset.current.y + dy 
      }));
  };

  const handlePanEnd = (e: React.PointerEvent) => {
      setIsPanning(false);
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  };

  const editingWidget = editingWidgetId === 'new' 
      ? { id: 'new', title: 'New Chart', type: 'bar', dataKey: columns[0]?.name || '', aggregation: 'count', layout: { x:0,y:0,w:300,h:300,zIndex:10 } } as ExtendedWidgetConfig
      : widgets.find(w => w.id === editingWidgetId);

  const handleDownloadImage = async () => {
      const wasEditMode = isEditMode;
      if (wasEditMode) {
          setIsEditMode(false);
          await new Promise(resolve => setTimeout(resolve, 200));
      }

      try {
          if (widgets.length === 0) return;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          widgets.forEach(w => {
              minX = Math.min(minX, w.layout.x);
              minY = Math.min(minY, w.layout.y);
              maxX = Math.max(maxX, w.layout.x + w.layout.w);
              maxY = Math.max(maxY, w.layout.y + w.layout.h);
          });

          const padding = 40;
          const width = (maxX - minX) + (padding * 2);
          const height = (maxY - minY) + (padding * 2);

          const container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.left = '-10000px';
          container.style.top = '0px';
          container.style.width = `${width}px`;
          container.style.height = `${height}px`;
          container.style.backgroundColor = '#0d0d0d'; 
          document.body.appendChild(container);

          widgets.forEach(w => {
              const node = document.getElementById(`widget-${w.id}`);
              if (node) {
                  const clone = node.cloneNode(true) as HTMLElement;
                  clone.style.transform = 'none'; 
                  clone.style.left = `${w.layout.x - minX + padding}px`;
                  clone.style.top = `${w.layout.y - minY + padding}px`;
                  clone.style.position = 'absolute';
                  clone.style.boxShadow = 'none'; 
                  clone.style.transition = 'none';
                  container.appendChild(clone);
              }
          });

          const canvas = await html2canvas(container, {
              backgroundColor: '#0d0d0d',
              scale: 2, 
              logging: false,
              useCORS: true,
              width: width,
              height: height,
              windowWidth: width,
              windowHeight: height,
              scrollX: 0,
              scrollY: 0
          });

          const link = document.createElement('a');
          link.download = `dashboard-${new Date().toISOString().slice(0,10)}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          document.body.removeChild(container);

      } catch (err) {
          console.error("Export failed:", err);
      } finally {
          if (wasEditMode) setIsEditMode(true);
      }
  };

  const dashboardContent = (
      <div className={`flex flex-col w-full bg-[#0d0d0d] ${isPresentation ? 'fixed inset-0 z-[9999] w-screen h-screen overflow-hidden select-none' : 'h-full relative'}`}>
          {/* Editor Modal */}
          {editingWidget && (
              <WidgetEditor 
                  widget={editingWidget}
                  columns={columns}
                  onSave={handleSaveWidget}
                  onCancel={() => setEditingWidgetId(null)}
                  onDelete={handleDeleteWidget}
              />
          )}

          {!isPresentation && (
              <div className="shrink-0">
                <ToolHeader 
                    title="Dashboard"
                    description="Drag & Drop a CSV to instantly visualize your data. Auto-detects schema to build a 'Bento' style dashboard."
                    instructions={[
                        "Create separate 'Spaces' (tabs) for different analyses",
                        "Filters are now specific to each space",
                        "Double-click tabs to rename them",
                        "In Edit Mode, drag cards anywhere (Free Positioning & Magnetic Snapping)"
                    ]}
                    icon={LayoutDashboard}
                    colorClass="text-violet-400"
                    onReset={() => { setRawData([]); setSpaces([]); setActiveSpaceId(null); setIsEditMode(false); setDefaultWidgets([]); }}
                    badge="Pre-Alpha"
                />
              </div>
          )}

          {rawData.length === 0 && spaces.length === 0 ? (
              <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 px-4">
                  <FileUploader 
                      onFileLoaded={handleFile} 
                      disabled={isLoading} 
                      theme="violet" 
                      limitText="CSV Files (Max 50k rows analyzed)"
                  />
                  {isLoading && (
                      <div className="mt-12 text-center text-violet-400 flex flex-col items-center gap-4">
                          <div className="relative">
                              <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                  <LayoutDashboard size={24} className="animate-pulse opacity-50" />
                              </div>
                          </div>
                          <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Analyzing Data Structure...</p>
                      </div>
                  )}
                  
                  {/* Load Layout from File - Visible on empty state too */}
                  <div className="mt-8 flex justify-center">
                      <button onClick={() => configInputRef.current?.click()} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">
                          <UploadIcon size={14} /> Load Existing Layout (.json)
                      </button>
                      <input type="file" ref={configInputRef} className="hidden" accept=".json" onChange={handleImportLayout} />
                  </div>
              </div>
          ) : (
              <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                  
                  {/* Space Tabs Bar */}
                  <div className={`
                      flex items-center px-4 sm:px-6 pt-2 shrink-0 z-[60] gap-2 overflow-x-auto no-scrollbar transition-all duration-300
                      ${isPresentation 
                          ? 'absolute top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-white/5' 
                          : 'bg-[#0d0d0d]'}
                  `}>
                      {spaces.map(space => (
                          <div 
                              key={space.id}
                              onClick={() => setActiveSpaceId(space.id)}
                              className={`
                                  relative group flex items-center gap-2 px-4 py-2 rounded-t-xl cursor-pointer select-none transition-all min-w-[100px] justify-center
                                  ${activeSpaceId === space.id 
                                      ? 'bg-gray-900 border-x border-white/5 text-violet-400 font-bold z-10' 
                                      : 'bg-gray-900/40 border-t border-x border-transparent hover:bg-gray-900/60 text-gray-500 hover:text-gray-300'}
                              `}
                          >
                              {/* Editable Name (Inline Input) */}
                              {renamingSpaceId === space.id ? (
                                  <input 
                                      type="text"
                                      autoFocus
                                      defaultValue={space.name}
                                      className="bg-transparent border-none outline-none text-violet-400 font-bold w-20 text-center"
                                      onBlur={(e) => {
                                          if (e.target.value.trim()) handleRenameSpace(space.id, e.target.value.trim());
                                          setRenamingSpaceId(null);
                                      }}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                              if (e.currentTarget.value.trim()) handleRenameSpace(space.id, e.currentTarget.value.trim());
                                              setRenamingSpaceId(null);
                                          }
                                          if (e.key === 'Escape') setRenamingSpaceId(null);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                  />
                              ) : (
                                  <span 
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setRenamingSpaceId(space.id);
                                    }}
                                    className="whitespace-nowrap"
                                    title="Double-click to rename"
                                  >
                                    {space.name}
                                  </span>
                              )}

                              {spaces.length > 1 && (
                                  <button 
                                      onClick={(e) => handleDeleteSpace(e, space.id)}
                                      className="p-0.5 hover:bg-red-500/20 text-gray-600 hover:text-red-400 rounded-full transition-colors ml-1 opacity-0 group-hover:opacity-100"
                                  >
                                      <X size={12} />
                                  </button>
                              )}
                          </div>
                      ))}
                      
                      <button 
                          onClick={handleAddSpace}
                          className="px-3 py-2 rounded-t-xl text-gray-600 hover:text-white hover:bg-gray-900/60 transition-colors"
                          title="Add New Space"
                      >
                          <Plus size={16} />
                      </button>
                  </div>

                  {/* Main Toolbar */}
                  <div className={`
                      flex items-center justify-between px-4 sm:px-6 py-3 shrink-0 z-50 transition-all duration-300
                      ${isPresentation 
                          ? 'absolute top-[45px] left-0 right-0 pointer-events-auto bg-gradient-to-b from-black/80 to-transparent hover:bg-black/90' 
                          : 'bg-gray-900/50 border-y border-white/5 mx-0 sm:mx-6 rounded-b-xl rounded-tr-xl'}
                  `}>
                      <div className="flex items-center gap-4 min-w-0">
                          {isPresentation && (
                              <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                                  <LayoutDashboard className="text-violet-500" size={20}/> 
                                  <span className="hidden sm:inline">Data Insights</span>
                              </h1>
                          )}
                          
                          <div className="flex items-center gap-2">
                              <button 
                                  onClick={() => setIsEditMode(!isEditMode)} 
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isEditMode ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                              >
                                  <Settings size={14} /> {isEditMode ? 'Done Editing' : 'Edit Layout'}
                              </button>
                              
                              {/* Config Buttons */}
                              <button onClick={() => configInputRef.current?.click()} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Load Layout"><FolderOpen size={16} /></button>
                              <input type="file" ref={configInputRef} className="hidden" accept=".json" onChange={handleImportLayout} />
                              
                              <button onClick={handleExportLayout} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Save Layout"><Save size={16} /></button>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                          {isEditMode && (
                              <button onClick={handleAddWidget} className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg transition-all animate-in zoom-in" title="Add Widget">
                                  <Plus size={18} />
                              </button>
                          )}
                          
                          <button onClick={handleDownloadImage} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all" title="Export PNG">
                              <Download size={18} />
                          </button>

                          <button 
                              onClick={() => setIsPresentation(!isPresentation)} 
                              className={`p-2 rounded-xl transition-all ${isPresentation ? 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                              title={isPresentation ? "Exit Full Screen (Esc)" : "Presentation Mode"}
                          >
                              {isPresentation ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                          </button>
                      </div>
                  </div>

                  {/* Persistent Filter Bar - BELOW Toolbar */}
                  {!isPresentation && (
                      <div className="px-6 py-2 bg-gray-950/50 border-b border-white/5 flex items-center gap-3 overflow-visible mx-6 z-40 relative">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-2">
                              <FilterX size={12}/> Active Filters:
                          </span>
                          
                          {/* Filter Menu Dropdown */}
                          <div className="relative" ref={filterMenuRef}>
                              <button 
                                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-[10px] font-bold transition-all"
                              >
                                  <Plus size={10} /> Add Filter
                              </button>
                              
                              {showFilterMenu && (
                                  <div className="absolute top-full left-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95">
                                      {!pendingFilterCol ? (
                                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                              <div className="p-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">Select Column</div>
                                              {columns.map(col => (
                                                  <button 
                                                      key={col.name} 
                                                      onClick={() => setPendingFilterCol(col.name)}
                                                      className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors truncate"
                                                  >
                                                      {col.name}
                                                  </button>
                                              ))}
                                          </div>
                                      ) : (
                                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                              <div className="p-2 flex items-center gap-2 border-b border-gray-800">
                                                  <button onClick={() => setPendingFilterCol(null)} className="text-gray-500 hover:text-white"><ChevronDown className="rotate-90" size={14}/></button>
                                                  <span className="text-[9px] font-bold text-white uppercase tracking-widest truncate flex-1">{pendingFilterCol}</span>
                                              </div>
                                              {/* Compute unique values for this column lazily */}
                                              {(() => {
                                                  const uniqueVals = Array.from(new Set(rawData.map(r => r[pendingFilterCol]).filter(v => v !== undefined && v !== null))).slice(0, 100); // Limit list
                                                  if(uniqueVals.length === 0) return <div className="p-4 text-xs text-gray-500 italic">No values found</div>;
                                                  return uniqueVals.map((val: any) => (
                                                      <button 
                                                          key={String(val)} 
                                                          onClick={() => handleFilter(pendingFilterCol, String(val))}
                                                          className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors truncate"
                                                      >
                                                          {String(val)}
                                                      </button>
                                                  ))
                                              })()}
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>

                          <div className="w-px h-4 bg-gray-800 mx-2"></div>
                          
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                              {Object.keys(activeFilters).length > 0 ? (
                                  <>
                                      {Object.entries(activeFilters).map(([k, v]) => (
                                          <button key={k} onClick={() => handleFilter(k, v)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors group whitespace-nowrap">
                                              <span className="opacity-70">{k}:</span> {v} <X size={10} className="opacity-50 group-hover:opacity-100"/>
                                          </button>
                                      ))}
                                      <button onClick={resetFilters} className="p-1 text-gray-500 hover:text-white text-[10px] uppercase font-bold tracking-wider transition-colors shrink-0">Clear All</button>
                                  </>
                              ) : (
                                  <span className="text-[10px] text-gray-600 italic">No filters applied.</span>
                              )}
                          </div>
                      </div>
                  )}

                  {/* Canvas Container - Truly Infinite */}
                  <div 
                    ref={containerRef}
                    className={`
                      flex-1 relative bg-[#0d0d0d] overflow-hidden 
                      ${isPresentation ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                      ${!isPresentation ? 'mx-0 sm:mx-6 mb-6 border-x border-b border-white/5 rounded-b-2xl' : ''}
                    `}
                    onPointerDown={handlePanStart}
                    onPointerMove={(e) => {
                        handlePanMove(e);
                        handleInteractionMove(e);
                    }}
                    onPointerUp={(e) => {
                        handlePanEnd(e);
                        handleInteractionEnd(e);
                    }}
                    onPointerLeave={(e) => {
                        handlePanEnd(e);
                        handleInteractionEnd(e);
                        setIsDragging(false);
                    }}
                    onWheel={handleWheel}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDashboardDrop}
                  >
                      {/* Grid Background Pattern - Only in Presentation/Edit Mode */}
                      {(isPresentation || isEditMode) && (
                          <div 
                            className="absolute inset-0 pointer-events-none opacity-20"
                            style={{
                                backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)',
                                backgroundSize: `${40 * panZoom.scale}px ${40 * panZoom.scale}px`,
                                backgroundPosition: `${panZoom.x}px ${panZoom.y}px`
                            }}
                          />
                      )}

                      {/* Drop Zone Overlay */}
                      {isDragging && (
                          <div className="absolute inset-0 z-[100] bg-violet-500/20 backdrop-blur-sm border-2 border-dashed border-violet-400 flex items-center justify-center pointer-events-none">
                              <div className="text-2xl font-bold text-white drop-shadow-md">Drop CSV to Load Data</div>
                          </div>
                      )}

                      {/* Missing Data Banner (If Layout Loaded but No Data) */}
                      {rawData.length === 0 && !isDragging && (
                           <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[90] bg-gray-900/90 border border-red-500/50 text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center gap-3 backdrop-blur-md pointer-events-auto">
                               <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-widest text-xs">
                                   <AlertTriangle size={16} /> Data Source Missing
                               </div>
                               <p className="text-sm text-gray-300">Layout loaded but no data found.</p>
                               <label className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 shadow-lg">
                                   <UploadIcon size={14} /> Upload CSV
                                   <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files && handleFile({ file: e.target.files[0] })} />
                               </label>
                           </div>
                      )}

                      {/* Infinite Canvas Effect */}
                      <div 
                        id="dashboard-canvas"
                        style={{
                            transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})`,
                            transformOrigin: '0 0',
                            width: '0px', 
                            height: '0px', // Zero size ensures no scrollbars on parent, pure transform
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            willChange: 'transform'
                        }}
                        className="relative"
                      >
                          {/* Snap Lines Layer */}
                          {snapLines.map((line, i) => (
                              <div 
                                  key={i}
                                  className={`absolute z-[9999] shadow-[0_0_8px_rgba(34,211,238,0.8)] ${line.type === 'gap' ? 'bg-fuchsia-500' : 'bg-cyan-400'}`}
                                  style={{
                                      left: line.orientation === 'vertical' ? line.position + 'px' : line.start + 'px',
                                      top: line.orientation === 'horizontal' ? line.position + 'px' : line.start + 'px',
                                      width: line.orientation === 'vertical' ? '1px' : (line.end - line.start) + 'px',
                                      height: line.orientation === 'horizontal' ? '1px' : (line.end - line.start) + 'px',
                                  }}
                              />
                          ))}

                          {widgets.map((widget) => {
                              const data = widget.type !== 'kpi' ? getWidgetData(widget) as any[] : [];
                              const val = widget.type === 'kpi' ? getWidgetData(widget) as number : 0;
                              
                              const isInteracting = widget.id === interactingWidgetId;

                              return (
                                  <div 
                                      key={widget.id} 
                                      id={`widget-${widget.id}`}
                                      className={`widget-container absolute transition-shadow ${isEditMode ? 'hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] ring-1 ring-white/5 hover:ring-violet-500/50' : ''}`}
                                      style={{
                                          transform: `translate(${widget.layout.x}px, ${widget.layout.y}px)`,
                                          width: widget.layout.w + 'px',
                                          height: widget.layout.h + 'px',
                                          zIndex: widget.layout.zIndex,
                                          touchAction: 'none'
                                      }}
                                      onDoubleClick={(e) => {
                                          if (isEditMode) {
                                              e.stopPropagation();
                                              setEditingWidgetId(widget.id);
                                          }
                                      }}
                                  >
                                      {/* Edit Header / Drag Handle */}
                                      {isEditMode && (
                                          <div 
                                            className="absolute -top-6 left-0 right-0 h-10 flex justify-center opacity-0 hover:opacity-100 transition-opacity z-50 cursor-move group"
                                            onPointerDown={(e) => handleInteractionStart(e, widget.id, 'drag')}
                                          >
                                               <div className="bg-gray-800/80 backdrop-blur text-gray-400 px-3 py-1 rounded-full shadow-xl border border-gray-600 flex items-center gap-2 scale-75 group-hover:scale-100 transition-transform">
                                                   <GripHorizontal size={14} />
                                                   <span className="text-[10px] font-bold uppercase tracking-widest">Drag</span>
                                               </div>
                                          </div>
                                      )}

                                      {/* Controls Top-Right */}
                                      {isEditMode && (
                                          <div className="absolute top-2 right-2 z-40 flex gap-1 transition-opacity">
                                              <button 
                                                className="bg-gray-900 hover:bg-violet-600 text-gray-400 hover:text-white p-1.5 rounded-lg shadow-lg border border-gray-700 transition-all scale-90 hover:scale-100"
                                                onClick={(e) => { e.stopPropagation(); setEditingWidgetId(widget.id); }}
                                              >
                                                  <Settings size={12} />
                                              </button>
                                              <button 
                                                className="bg-gray-900 hover:bg-red-600 text-gray-400 hover:text-white p-1.5 rounded-lg shadow-lg border border-gray-700 transition-all scale-90 hover:scale-100"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    updateActiveSpace(s => ({
                                                        ...s,
                                                        widgets: s.widgets.filter(w => w.id !== widget.id)
                                                    })); 
                                                }}
                                              >
                                                  <Trash2 size={12} />
                                              </button>
                                          </div>
                                      )}

                                      {/* Main Content Area - Full Centering */}
                                      <div 
                                        className={`w-full h-full rounded-2xl overflow-hidden ${isInteracting ? 'cursor-grabbing' : ''}`}
                                        // Allow dragging from body in edit mode
                                        onPointerDown={isEditMode ? (e) => handleInteractionStart(e, widget.id, 'drag') : undefined}
                                      >
                                          <div className={`w-full h-full flex flex-col ${isEditMode ? 'pointer-events-none' : ''}`}>
                                              {widget.type === 'kpi' ? (
                                                  <KpiWidget 
                                                      config={widget} 
                                                      value={val} 
                                                      onClick={isEditMode ? undefined : undefined} 
                                                  />
                                              ) : (
                                                  <ChartWidget 
                                                      config={widget} 
                                                      data={data} 
                                                      isActiveFilter={!!activeFilters[widget.dataKey]}
                                                  />
                                              )}
                                          </div>
                                      </div>

                                      {/* Resize Handle */}
                                      {isEditMode && (
                                          <div 
                                            className="absolute bottom-0 right-0 w-8 h-8 z-50 cursor-se-resize flex items-end justify-end p-1.5 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                                            onPointerDown={(e) => handleInteractionStart(e, widget.id, 'resize')}
                                          >
                                              <div className="w-full h-full rounded-br-lg border-b-2 border-r-2 border-violet-500"></div>
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  {/* Presentation Controls */}
                  {isPresentation && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 z-50 shadow-2xl pointer-events-auto">
                          <button onClick={() => centerView(0.75)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Reset View"><RotateCcw size={18} /></button>
                          <div className="w-px h-4 bg-white/10"></div>
                          <button onClick={() => setPanZoom(p => ({ ...p, scale: Math.max(0.1, p.scale - 0.1) }))} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Zoom Out"><ZoomOut size={18} /></button>
                          <span className="text-xs font-mono text-gray-300 w-12 text-center">{Math.round(panZoom.scale * 100)}%</span>
                          <button onClick={() => setPanZoom(p => ({ ...p, scale: Math.min(5, p.scale + 0.1) }))} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Zoom In"><ZoomIn size={18} /></button>
                      </div>
                  )}
              </div>
          )}
      </div>
  );

  if (isPresentation) {
      return createPortal(dashboardContent, document.body);
  }

  return dashboardContent;
};

export default InstantDashboardTool;
