
import React, { useState, useEffect } from 'react';
import { 
    Activity, BarChart3, LineChart, Layers, PieChart, Circle, ScatterChart, Calendar, 
    Edit3, X, ArrowUpDown, AlignJustify, Palette, Clock, Save, Trash2, Type, ArrowRight,
    MoveRight, Hash, CheckSquare, Square
} from 'lucide-react';
import { ExtendedWidgetConfig, ExtendedColumnAnalysis, AggregationType } from './types';
import { ColumnAnalysis } from '../../../utils/dashboardHelpers';
import { NEON_PALETTE } from './constants';

interface WidgetEditorProps { 
    widget: ExtendedWidgetConfig;
    columns: ColumnAnalysis[]; 
    spaces: { id: string; name: string }[];
    currentSpaceId: string;
    onSave: (w: ExtendedWidgetConfig) => void;
    onCancel: () => void;
    onDelete: () => void;
    onMove: (widgetId: string, targetSpaceId: string) => void;
}

const AGGREGATION_OPTIONS: { id: AggregationType, label: string }[] = [
    { id: 'none', label: 'None (Raw Values)' },
    { id: 'count', label: 'Count Rows' },
    { id: 'sum', label: 'Sum' },
    { id: 'avg', label: 'Average (Mean)' },
    { id: 'median', label: 'Median' },
    { id: 'min', label: 'Minimum' },
    { id: 'max', label: 'Maximum' },
    { id: 'stddev', label: 'Std. Deviation' },
    { id: 'variance', label: 'Variance' },
    { id: 'distinct', label: 'Distinct Count' },
    { id: 'mode', label: 'Mode (Frequent)' }
];

const WidgetEditor: React.FC<WidgetEditorProps> = ({ 
    widget, 
    columns, 
    spaces,
    currentSpaceId,
    onSave, 
    onCancel, 
    onDelete,
    onMove
}) => {
    const [config, setConfig] = useState<ExtendedWidgetConfig>({ ...widget });

    useEffect(() => {
        if (!config.metricKeys && config.secondaryKey) {
            setConfig(prev => ({ ...prev, metricKeys: [prev.secondaryKey!] }));
        }
    }, []);

    const handleDataKeyChange = (key: string) => {
        const col = columns.find(c => c.name === key);
        let updates: Partial<ExtendedWidgetConfig> = { dataKey: key };
        
        if (col && col.type === 'date') {
            updates.type = 'timeline';
            updates.limit = undefined;
        } else if (config.type === 'timeline') {
            updates.type = 'bar';
        }
        
        setConfig({ ...config, ...updates });
    };

    const toggleMetric = (colName: string) => {
        const current = config.metricKeys || [];
        const newMetrics = current.includes(colName)
            ? current.filter(m => m !== colName)
            : [...current, colName];
        setConfig({ ...config, metricKeys: newMetrics });
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200" onPointerDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
            <div className="bg-[#111827] border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                            <Edit3 size={18} />
                        </div>
                        Edit Widget
                    </h3>
                    <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 min-h-0 bg-[#111827]">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Widget Title</label>
                        <input 
                            type="text" 
                            value={config.title} 
                            onChange={(e) => setConfig({ ...config, title: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all placeholder:text-gray-600"
                            placeholder="e.g. Monthly Revenue"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visualization Type</label>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { id: 'kpi', icon: Activity, label: 'KPI' },
                                { id: 'bar', icon: BarChart3, label: 'Bar' },
                                { id: 'line', icon: LineChart, label: 'Line' },
                                { id: 'area', icon: Layers, label: 'Area' },
                                { id: 'pie', icon: PieChart, label: 'Pie' },
                                { id: 'donut', icon: Circle, label: 'Donut' },
                                { id: 'scatter', icon: ScatterChart, label: 'Scatter' },
                                { id: 'timeline', icon: Calendar, label: 'Time' },
                            ].map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => setConfig({ ...config, type: t.id as any })}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2 ${config.type === t.id ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/20' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'}`}
                                >
                                    <t.icon size={20} />
                                    <span className="text-[9px] uppercase font-bold tracking-wide">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                {config.type === 'kpi' ? 'Metric (Value)' : 'Group By (X-Axis)'}
                            </label>
                            <div className="relative">
                                <select 
                                    value={config.dataKey}
                                    onChange={(e) => handleDataKeyChange(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                                >
                                    {columns.map((c, i) => (
                                        <option key={c.name} value={c.name}>
                                            {c.name} ({c.type})
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ArrowUpDown size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Aggregation</label>
                            <div className="relative">
                                <select 
                                    value={config.aggregation}
                                    onChange={(e) => {
                                        const newAgg = e.target.value as any;
                                        let newMetrics = config.metricKeys;
                                        if (newAgg !== 'count' && (!newMetrics || newMetrics.length === 0)) {
                                            const firstNum = columns.find(c => c.type === 'number');
                                            if (firstNum) newMetrics = [firstNum.name];
                                        }
                                        setConfig({ ...config, aggregation: newAgg, metricKeys: newMetrics });
                                    }}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                                >
                                    {AGGREGATION_OPTIONS.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ArrowUpDown size={14} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {(config.aggregation !== 'count') && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Value Columns (Y-Axis)</label>
                            <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {columns.filter(c => c.type === 'number').map(c => {
                                    const isSelected = config.metricKeys?.includes(c.name);
                                    return (
                                        <div 
                                            key={c.name}
                                            onClick={() => toggleMetric(c.name)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-violet-500/20 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`}>
                                                {isSelected && <CheckSquare size={10} className="text-white" />}
                                            </div>
                                            <span className="text-xs font-medium truncate">{c.name}</span>
                                        </div>
                                    );
                                })}
                                {columns.filter(c => c.type === 'number').length === 0 && (
                                    <div className="text-center text-xs text-gray-500 py-4 italic">No numeric columns found</div>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500 pt-1">Select one or more columns to plot.</p>
                        </div>
                    )}

                    <div className="pt-2 border-t border-gray-800 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            {config.type !== 'kpi' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <Hash size={12} /> Limit Items (Top N)
                                    </label>
                                    <input 
                                        type="number" 
                                        value={config.limit || ''} 
                                        onChange={(e) => setConfig({ ...config, limit: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                                        placeholder="All (Auto-scroll)"
                                    />
                                </div>
                            )}

                            {config.type !== 'kpi' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <ArrowUpDown size={12} /> Sort Order
                                    </label>
                                    <div className="relative">
                                        <select 
                                            value={config.sortBy || 'value_desc'}
                                            onChange={(e) => setConfig({ ...config, sortBy: e.target.value as any })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="value_desc">Highest Value First</option>
                                            <option value="value_asc">Lowest Value First</option>
                                        </select>
                                        <ArrowUpDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {config.type !== 'kpi' && config.type !== 'pie' && config.type !== 'donut' && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Type size={12} /> Axis Labels
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input 
                                        type="text" 
                                        value={config.xAxisLabel || ''} 
                                        onChange={(e) => setConfig({ ...config, xAxisLabel: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                                        placeholder="X-Axis Label"
                                    />
                                    <input 
                                        type="text" 
                                        value={config.yAxisLabel || ''} 
                                        onChange={(e) => setConfig({ ...config, yAxisLabel: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                                        placeholder="Y-Axis Label"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Palette size={12} /> Color Theme
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => setConfig({ ...config, chartColor: undefined })}
                                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${!config.chartColor ? 'border-white ring-2 ring-white/10' : 'border-gray-700 opacity-60 hover:opacity-100'}`}
                                    title="Auto (Rainbow)"
                                >
                                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-pink-500"></span>
                                </button>
                                {NEON_PALETTE.map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setConfig({ ...config, chartColor: c })}
                                        className={`w-8 h-8 rounded-full border transition-all hover:scale-110 ${config.chartColor === c ? 'border-white ring-2 ring-white/20' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        {(config.type === 'timeline' || config.type === 'line' || config.type === 'area') && (
                            <div className="space-y-2 animate-in fade-in">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={12} /> Date Grouping
                                </label>
                                <div className="grid grid-cols-5 gap-1">
                                    {['auto', 'day', 'week', 'month', 'year'].map(g => (
                                        <button 
                                            key={g}
                                            onClick={() => setConfig({ ...config, timeGrain: g as any })}
                                            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${config.timeGrain === g || (!config.timeGrain && g === 'auto') ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                        >
                                            {g.charAt(0).toUpperCase() + g.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-6 border-t border-gray-800 bg-gray-900 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 shrink-0 z-10">
                    <button 
                        onClick={onDelete} 
                        className="group flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors w-full sm:w-auto justify-center sm:justify-start"
                    >
                        <Trash2 size={16} className="group-hover:scale-110 transition-transform" /> 
                        <span>Delete</span>
                    </button>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <div className={`relative w-full sm:w-auto group ${spaces.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none z-10">
                                <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-gray-200 transition-colors">MOVE TO</span>
                                <MoveRight size={12} className="text-gray-500 group-hover:text-white transition-colors" />
                            </div>
                            <select
                                value=""
                                onChange={(e) => onMove(config.id, e.target.value)}
                                disabled={spaces.length <= 1}
                                className="w-full sm:w-36 appearance-none bg-gray-800 border border-gray-700 hover:border-gray-600 text-transparent rounded-xl py-3 pl-4 pr-8 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="" disabled hidden>MOVE TO</option>
                                {spaces.map(s => (
                                    <option key={s.id} value={s.id} disabled={s.id === currentSpaceId} className="text-gray-900">
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button 
                                onClick={onCancel} 
                                className="flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => onSave(config)} 
                                className="flex-1 sm:flex-none px-8 py-3 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20 hover:shadow-violet-900/40 transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Save size={16} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WidgetEditor;
