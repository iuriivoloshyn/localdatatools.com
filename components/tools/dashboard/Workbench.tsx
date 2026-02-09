import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ExtendedWidgetConfig, ExtendedColumnAnalysis, FilterConfig, AggregationType } from './types';
import { NEON_PALETTE } from './constants';
import { 
    LayoutDashboard, BarChart3, LineChart, PieChart, Activity, Save, X, 
    MessageSquare, Send, Sparkles, Bot, Loader2, ArrowRight, Settings, 
    Palette, Type, Hash, Calendar, ChevronDown, Check, RefreshCw, Cpu, Download,
    Filter, Plus, Trash2, Edit2, RotateCcw, CheckSquare, Square, Layers, ArrowUpDown,
    ZoomIn, MessageCircle, Terminal, EyeOff, Eye
} from 'lucide-react';
import { ChartWidget, KpiWidget } from './DashboardWidgets';
import { useGemma } from '../../../contexts/GemmaContext';

interface WorkbenchProps {
    config: ExtendedWidgetConfig;
    onConfigChange: (config: ExtendedWidgetConfig) => void;
    columns: ExtendedColumnAnalysis[];
    data: any[]; 
    onSaveToDashboard: (config: ExtendedWidgetConfig) => void;
    onCancel: () => void;
    onCalculateData: (config: ExtendedWidgetConfig) => any;
    chatHistory: {role: 'user'|'model', content: string}[];
    setChatHistory: React.Dispatch<React.SetStateAction<{role: 'user'|'model', content: string}[]>>;
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

const Workbench: React.FC<WorkbenchProps> = ({ 
    config, 
    onConfigChange, 
    columns, 
    data, 
    onSaveToDashboard, 
    onCancel, 
    onCalculateData, 
    chatHistory, 
    setChatHistory
}) => {
    const [previewData, setPreviewData] = useState<any>([]);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);
    const [showHiddenFields, setShowHiddenFields] = useState(false);
    
    // AI State
    const { engine, isModelLoaded, initGemma, isLoading: isModelLoading, progress: modelProgress, progressVal: modelProgressVal } = useGemma();
    const [chatInput, setChatInput] = useState("");
    const [isAiThinking, setIsAiThinking] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // --- SMART COLUMN CLASSIFICATION ---
    const { dimensionCols, measureCols } = useMemo(() => {
        const dimensionCols = columns.filter(c => {
            // Always include non-numbers
            if (c.type !== 'number') return true;
            // Include numbers if they look like IDs
            if (c.isIdLike) return true;
            // Include numbers if they are low cardinality (categories encoded as numbers, e.g. Pclass, Rating 1-5)
            if (c.uniqueCount <= 50) return true;
            // Otherwise, hide high-cardinality continuous numbers (like Fare, Exact Timestamp) from X-Axis to prevent clutter
            return showHiddenFields;
        });

        const measureCols = columns.filter(c => {
            if (c.type !== 'number') return false;
            // Exclude IDs from being summed/averaged (Sum of PassengerId is meaningless)
            if (c.isIdLike) return false;
            return true;
        });

        return { dimensionCols, measureCols };
    }, [columns, showHiddenFields]);

    // Update preview data whenever config changes
    useEffect(() => {
        if (config.dataKey || config.type === 'kpi') {
            const d = onCalculateData(config);
            setPreviewData(d);
        } else {
            setPreviewData([]);
        }
    }, [config, onCalculateData]);

    useEffect(() => {
        if(chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chatHistory]);

    // Close filter menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setIsFilterMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClearChart = () => {
        onConfigChange({
            ...config,
            dataKey: '',
            metricKeys: [],
            secondaryKey: undefined,
            filters: {},
            title: 'New Chart',
            xAxisLabel: undefined,
            yAxisLabel: undefined,
            zoomLevel: 1
        });
    };

    const sanitizeConfig = (aiConfig: any, currentConfig: ExtendedWidgetConfig, cols: ExtendedColumnAnalysis[]) => {
        const clean: any = { ...aiConfig };

        // Normalize common AI hallucinations/aliases
        if (clean.filter && !clean.filters) clean.filters = clean.filter;
        if (clean.metrics && !clean.metricKeys) clean.metricKeys = clean.metrics;
        if (clean.xAxis && !clean.dataKey) clean.dataKey = clean.xAxis;
        if (clean.yAxis && !clean.metricKeys) clean.metricKeys = clean.yAxis;

        // Helper: Find exact column name case-insensitively
        const findCol = (name: string) => {
            if (!name) return undefined;
            const exact = cols.find(c => c.name === name);
            if (exact) return exact.name;
            const lower = name.toLowerCase();
            const loose = cols.find(c => c.name.toLowerCase() === lower);
            if (loose) return loose.name;
            // Fuzzy match
            const partial = cols.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
            return partial ? partial.name : undefined;
        };

        if (clean.dataKey) clean.dataKey = findCol(clean.dataKey);
        
        if (clean.metricKeys) {
            if (!Array.isArray(clean.metricKeys)) clean.metricKeys = [clean.metricKeys];
            clean.metricKeys = clean.metricKeys.map((m: string) => findCol(m)).filter(Boolean);
        }

        // Sanitizing Filters
        if (clean.filters) {
            const newFilters: Record<string, FilterConfig> = {};
            
            Object.entries(clean.filters).forEach(([key, val]: [string, any]) => {
                let realColName = findCol(key);
                
                // INTELLIGENT RECOVERY: If key doesn't match a column, check if the VALUE matches a column's samples
                if (!realColName && val.selected && Array.isArray(val.selected) && val.selected.length > 0) {
                    const sampleVal = String(val.selected[0]).toLowerCase();
                    // Find a column that has this value in its topValues
                    const matchCol = cols.find(c => c.topValues?.some(v => String(v).toLowerCase() === sampleVal));
                    if (matchCol) realColName = matchCol.name;
                }

                if (!realColName) return; 

                const colDef = cols.find(c => c.name === realColName);
                if (!colDef) return;

                const isNumeric = colDef.type === 'number';
                let type = val.type;

                // Fix: Ensure numeric columns get 'range' if min/max present, or 'select' if specific values
                if (isNumeric) {
                    if (val.min !== undefined || val.max !== undefined) type = 'range';
                    else type = 'select';
                } else {
                    // Force text columns to use select
                    type = 'select';
                    if (val.min) delete val.min;
                    if (val.max) delete val.max;
                }

                let selected = val.selected;
                // AI often returns single string for selected, force array
                if (selected && !Array.isArray(selected)) selected = [selected];
                
                // If select filter but empty, try to use raw string value if AI messed up structure
                if (type === 'select' && (!selected || selected.length === 0) && typeof val === 'string') {
                     selected = [val];
                }

                newFilters[realColName] = {
                    type: type || 'select',
                    selected,
                    min: val.min,
                    max: val.max
                };
            });
            clean.filters = newFilters;
        }

        return clean;
    };

    const handleAiSubmit = async () => {
        if (!chatInput.trim() || !engine) return;
        
        const userMsg = chatInput;
        setChatInput("");
        setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsAiThinking(true);

        try {
            // Enhanced Context
            const columnContext = columns.map(c => {
                const typeInfo = c.type === 'number' 
                    ? `TYPE: Number (Range: ${c.min} to ${c.max})` 
                    : `TYPE: Category (Unique: ${c.uniqueCount})`;
                const sampleVals = c.topValues?.slice(0, 8).join(", ") || "";
                const idTag = c.isIdLike || c.isUniform ? " [POSSIBLE ID]" : "";
                return `- Column "${c.name}": ${typeInfo}. Samples: [${sampleVals}]${idTag}`;
            }).join('\n');
            
            const currentConfigJson = JSON.stringify({
                type: config.type,
                title: config.title,
                xAxis: config.dataKey,
                metrics: config.metricKeys,
                aggregation: config.aggregation,
                filters: config.filters,
                sortBy: config.sortBy
            });

            const systemPrompt = `You are a Data Analysis Assistant. You can chat about data OR update the dashboard config.

DATA SCHEMA:
${columnContext}

CURRENT CONFIG:
${currentConfigJson}

INSTRUCTIONS:
1. **Chat**: Answer questions about data analysis or give advice.
2. **Action**: If the user wants to see data, output a JSON config block wrapped in \`\`\`json ... \`\`\`.
3. **Hybrid**: You can provide text explanations AND a JSON block.

CRITICAL RULES for JSON Config:
1. **Top N / Ranking / Raw Data**:
   - Request: "Top 5 [Metric]", "Largest [Metric]", "Best", "List the...", "Show me rows where...".
   - **Scenario**: User wants to see individual items sorted by a metric, NOT an aggregate.
   - Action: Set "aggregation": "none", "sortBy": "value_desc", "limit": 5 (or N).
   - If a call ID/Name column exists, set "dataKey" to it.
   - If NO ID column, set "dataKey" to the Metric column itself to list the values.
2. **Chart vs KPI (SCALAR VALUES)**:
   - Request: "How many...", "Total...", "Count...", "Average...", "Sum of..." WITHOUT saying "by [Column]" or "over time".
   - **ACTION**: Set "type": "kpi". Remove "dataKey" (set to null/undefined).
   - Example: "Number of males" -> { "type": "kpi", "filters": {"Sex": { "selected": ["male"] }} }
3. **Dimension Selection (dataKey) for Charts**:
   - If User says "By [Column]", use that column.
   - If User DOES NOT specify:
     - Prefer **Categorical/Text** columns with low cardinality (e.g., Department, Region, Class).
     - **AVOID** grouping by Numeric columns (Age, Price) unless asked for "Distribution" or "Histogram".
     - **AVOID** grouping by a column that is currently Filtered to a single value.
4. **Metrics & Aggregation**:
   - "Average Tip" -> aggregation: "avg", metricKeys: ["tip"].
   - "Sum of Fare" -> aggregation: "sum", metricKeys: ["fare"].
   - "Max Price" -> aggregation: "max", metricKeys: ["Price"].
   - "How many rows" -> aggregation: "count".
   - **CRITICAL**: If the user asks for a calculation on a specific column (e.g. Average Tip), you MUST set "metricKeys" to that column AND "aggregation" to the correct type.
   - For KPIs (Global Stats), you MUST remove "dataKey" so it aggregates the whole dataset.
5. **Filtering**:
   - "Males aged 20-30" -> filters: { "Sex": { "type": "select", "selected": ["male"] }, "Age": { "type": "range", "min": 20, "max": 30 } }.
   - **IMPORTANT**: Use 'filters' (plural). Use 'metricKeys' (plural) for values.

Response Template:
\`\`\`json
{
  "type": "kpi",
  "metricKeys": ["tip"], 
  "aggregation": "avg",
  "filters": { "Sex": { "selected": ["male"] } },
  "title": "Average Tip"
}
\`\`\`
`;

            // Prepare the conversation history
            const historyContext = chatHistory.map(h => ({
                role: h.role === 'model' ? 'assistant' : 'user',
                content: h.content
            }));

            const response = await engine.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt }, 
                    ...historyContext, 
                    { role: "user", content: userMsg }
                ],
                temperature: 0.1 // Low temperature for consistent JSON
            });

            const content = response.choices[0].message.content || "";
            
            let updates: any = null;
            let textReply = content;

            // Extract JSON
            const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                try {
                    updates = JSON.parse(codeBlockMatch[1]);
                    // Remove the JSON block from the text shown to user
                    textReply = content.replace(codeBlockMatch[0], "").trim();
                } catch (e) { console.error("JSON Parse Error", e); }
            } else {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try { 
                        if(jsonMatch[0].includes("type") || jsonMatch[0].includes("dataKey") || jsonMatch[0].includes("aggregation")) {
                            updates = JSON.parse(jsonMatch[0]); 
                            textReply = content.replace(jsonMatch[0], "").trim(); 
                        }
                    } catch(e){}
                }
            }

            if (updates) {
                const safeUpdates = sanitizeConfig(updates, config, columns);

                // Apply heuristics
                // 1. KPI Default - AGGRESSIVE OVERRIDE
                // If user asks for a scalar value (count/total/sum) and DOES NOT ask for grouping (by/trend/breakdown), force KPI.
                const isScalarQuestion = (/how many|count of|total|sum of|average|what is the/i.test(userMsg)) && !(/by|per|group|trend|breakdown|distribution|vs/i.test(userMsg));
                
                if (isScalarQuestion) {
                     safeUpdates.type = 'kpi';
                     safeUpdates.dataKey = undefined; // Force global aggregation
                }
                
                // If it is a KPI, ensure grouping is removed so it processes globally
                if (safeUpdates.type === 'kpi') {
                    safeUpdates.dataKey = undefined;
                }

                // 2. DataKey Fallback (Only if not KPI)
                if (safeUpdates.type !== 'kpi' && (safeUpdates.type || config.type) !== 'kpi' && !safeUpdates.dataKey && !config.dataKey) {
                    // Try to find a categorical column that isn't being filtered
                    const filterKeys = Object.keys(safeUpdates.filters || config.filters || {});
                    const defaultCol = columns.find(c => 
                        (c.type === 'categorical' || c.isIdLike || c.type === 'text') && 
                        !filterKeys.includes(c.name)
                    ) || columns[0];
                    
                    if (defaultCol) safeUpdates.dataKey = defaultCol.name;
                }

                // 3. Aggregation Default - ONLY if NOT set by AI
                if (!safeUpdates.aggregation && !config.aggregation) {
                    if (safeUpdates.metricKeys && safeUpdates.metricKeys.length > 0) {
                         const firstM = columns.find(c => c.name === safeUpdates.metricKeys![0]);
                         safeUpdates.aggregation = (firstM?.type === 'number') ? 'sum' : 'count';
                    } else {
                        safeUpdates.aggregation = 'count';
                    }
                }

                onConfigChange({ ...config, ...safeUpdates });
                
                if (!textReply) textReply = "Chart updated based on your request.";
            }

            setChatHistory(prev => [...prev, { role: 'model', content: textReply || "I'm listening." }]);

        } catch (e) {
            console.error(e);
            setChatHistory(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error processing that." }]);
        } finally {
            setIsAiThinking(false);
        }
    };

    const toggleMetric = (colName: string) => {
        const currentMetrics = config.metricKeys || [];
        const newMetrics = currentMetrics.includes(colName)
            ? currentMetrics.filter(m => m !== colName)
            : [...currentMetrics, colName];
        
        onConfigChange({ ...config, metricKeys: newMetrics, aggregation: 'sum' });
    };

    const addFilter = (colName: string) => {
        const newFilters = { ...config.filters };
        const col = columns.find(c => c.name === colName);
        const type = 'select'; 
        const initialSelected: string[] = []; 
        
        newFilters[colName] = { type, selected: initialSelected, min: undefined, max: undefined };
        onConfigChange({ ...config, filters: newFilters });
        setIsFilterMenuOpen(false);
    };

    const removeFilter = (colName: string) => {
        const newFilters = { ...config.filters };
        delete newFilters[colName];
        onConfigChange({ ...config, filters: newFilters });
    };

    const updateFilterType = (colName: string, type: 'select' | 'range') => {
        const filters = { ...config.filters };
        if (filters[colName]) {
            filters[colName] = { ...filters[colName], type };
            onConfigChange({ ...config, filters });
        }
    };

    const toggleFilterValue = (colName: string, value: string) => {
        const filters = { ...config.filters };
        const currentFilter = filters[colName];
        if (currentFilter) {
            const currentSelected = currentFilter.selected || [];
            const newSelected = currentSelected.includes(value) 
                ? currentSelected.filter(v => v !== value) 
                : [...currentSelected, value];
            
            filters[colName] = { ...currentFilter, selected: newSelected, type: 'select' };
            onConfigChange({ ...config, filters });
        }
    };

    const setFilterValues = (colName: string, values: string[]) => {
        const filters = { ...config.filters };
        const currentFilter = filters[colName];
        if (currentFilter) {
            filters[colName] = { ...currentFilter, selected: values, type: 'select' };
            onConfigChange({ ...config, filters });
        }
    };

    const updateRangeFilter = (colName: string, min: string, max: string) => {
        const filters = { ...config.filters };
        if (filters[colName]) {
            const minVal = min === '' ? undefined : Number(min);
            const maxVal = max === '' ? undefined : Number(max);
            filters[colName] = { ...filters[colName], min: minVal, max: maxVal, type: 'range' };
            onConfigChange({ ...config, filters });
        }
    };

    const isCartesian = ['bar', 'line', 'area', 'scatter', 'timeline'].includes(config.type);

    return (
        <div className="flex flex-col lg:flex-row min-h-full animate-in fade-in zoom-in-95 duration-300">
            {/* Left: Columns & Basics */}
            <div className="w-full lg:w-64 border-r border-white/10 bg-gray-900/30 flex flex-col shrink-0">
                <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data Fields</h3>
                    <button 
                        onClick={() => setShowHiddenFields(!showHiddenFields)}
                        className={`p-1.5 rounded-lg transition-colors ${showHiddenFields ? 'text-violet-400 bg-violet-500/10' : 'text-gray-500 hover:text-white'}`}
                        title={showHiddenFields ? "Hide High-Cardinality Numbers" : "Show All Fields"}
                    >
                        {showHiddenFields ? <Eye size={14}/> : <EyeOff size={14}/>}
                    </button>
                </div>
                <div className="p-4 pt-2 flex-1 space-y-6">
                    <div>
                        <div className="text-[10px] font-black text-violet-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                            Dimensions <span className="text-gray-600 opacity-50">(X-Axis)</span>
                        </div>
                        <div className="space-y-1">
                            {dimensionCols.map(c => (
                                <button 
                                    key={c.name}
                                    onClick={() => onConfigChange({...config, dataKey: c.name})}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 group ${config.dataKey === c.name ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                                >
                                    {c.type === 'date' ? <Calendar size={12} className="opacity-70"/> : c.type === 'number' ? <Hash size={12} className="opacity-70"/> : <Type size={12} className="opacity-70"/>}
                                    <span className="truncate flex-1">{c.name}</span>
                                    {c.uniqueCount <= 20 && <span className="text-[9px] opacity-40">{c.uniqueCount}</span>}
                                </button>
                            ))}
                            {dimensionCols.length === 0 && <div className="text-[10px] text-gray-600 italic px-2">No categorical fields found.</div>}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-cyan-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                            Measures <span className="text-gray-600 opacity-50">(Values)</span>
                        </div>
                        <div className="space-y-1">
                            {measureCols.map(c => {
                                const isSelected = config.metricKeys?.includes(c.name);
                                return (
                                    <button 
                                        key={c.name}
                                        onClick={() => toggleMetric(c.name)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${isSelected ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {isSelected ? <CheckSquare size={12} /> : <Hash size={12} className="opacity-70"/>}
                                        <span className="truncate">{c.name}</span>
                                    </button>
                                );
                            })}
                            {measureCols.length === 0 && <div className="text-[10px] text-gray-600 italic px-2">No numeric fields found.</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Center: Canvas & Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-grid-pattern">
                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-3 w-full max-w-lg">
                        <div className="relative group w-full">
                            <input 
                                value={config.title}
                                onChange={(e) => onConfigChange({...config, title: e.target.value})}
                                className="bg-transparent text-white font-bold text-xl outline-none placeholder-gray-600 w-full border-b border-transparent focus:border-violet-500 hover:border-white/20 transition-all pb-1"
                                placeholder="Name your analysis..."
                            />
                            <Edit2 size={12} className="absolute right-0 top-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleClearChart}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                            title="Clear Chart"
                        >
                            <RotateCcw size={16} />
                        </button>
                        <button 
                            onClick={() => onSaveToDashboard(config)}
                            disabled={!config.dataKey && config.type !== 'kpi'}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <LayoutDashboard size={14} />
                            <span>Add to Dashboard</span>
                        </button>
                    </div>
                </div>

                {/* Content Area - Scrollable */}
                <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-32 flex flex-col gap-6">
                    {/* Chart Preview */}
                    <div className="bg-gray-900/40 border border-white/10 rounded-3xl p-1 shadow-2xl relative overflow-hidden backdrop-blur-sm h-[500px] shrink-0">
                        {(!config.dataKey && config.type !== 'kpi') ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <BarChart3 size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium">Select a data dimension from the left sidebar to start.</p>
                            </div>
                        ) : (
                            config.type === 'kpi' ? (
                                <KpiWidget config={config} value={typeof previewData === 'number' ? previewData : 0} />
                            ) : (
                                <ChartWidget config={config} data={Array.isArray(previewData) ? previewData : []} />
                            )
                        )}
                    </div>

                    {/* AI Chat Overlay */}
                    <div className="bg-[#111827] border border-gray-800 rounded-2xl flex flex-col shadow-xl overflow-hidden shrink-0 h-64">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={chatScrollRef}>
                            {chatHistory.length === 0 ? (
                                <div className="text-center text-gray-600 text-xs py-8 space-y-2">
                                    <Sparkles className="mx-auto mb-2 opacity-50" size={24}/>
                                    <p>Ask Gemma to analyze this chart, help you style it, or just chat about the data.</p>
                                    <p className="opacity-60">Try: "Top 5 values", "What does this mean?", "Switch to Bar Chart"</p>
                                </div>
                            ) : (
                                chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isAiThinking && <div className="text-violet-400 flex gap-1 justify-center"><span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span></div>}
                        </div>
                        <div className="p-3 bg-gray-950 border-t border-gray-800 flex gap-2 relative">
                            {isModelLoading && (
                                <div className="absolute inset-0 bg-gray-950/90 z-20 flex flex-col items-center justify-center">
                                    <div className="w-full max-w-xs space-y-2">
                                        <div className="flex justify-between text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                            <span>{modelProgress || "Downloading AI..."}</span>
                                            <span>{Math.round(modelProgressVal * 100)}%</span>
                                        </div>
                                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${modelProgressVal * 100}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <input 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
                                placeholder={!isModelLoaded ? "Load Gemma to enable AI..." : "Ask questions or describe changes..."}
                                disabled={!isModelLoaded || isAiThinking}
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-violet-500 outline-none"
                            />
                            {!isModelLoaded ? (
                                <button onClick={initGemma} className="p-2 bg-violet-600/20 text-violet-400 rounded-xl hover:bg-violet-600 hover:text-white transition-colors flex items-center gap-2 px-3">
                                    {isModelLoading ? <Loader2 size={16} className="animate-spin"/> : <Cpu size={16}/>}
                                    <span className="text-xs font-bold hidden sm:inline">Load AI</span>
                                </button>
                            ) : (
                                <button onClick={handleAiSubmit} disabled={isAiThinking} className="p-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-colors disabled:opacity-50">
                                    <Send size={16}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Settings */}
            <div className="w-full lg:w-72 border-l border-white/10 bg-gray-900/30 p-6 space-y-8 shrink-0">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><LayoutDashboard size={12}/> Chart Type</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'bar', icon: BarChart3 }, { id: 'line', icon: LineChart }, 
                            { id: 'pie', icon: PieChart }, { id: 'kpi', icon: Activity },
                            { id: 'area', icon: Layers, label: 'Area' }, 
                        ].map(t => (
                            <button 
                                key={t.id}
                                onClick={() => onConfigChange({...config, type: t.id as any})}
                                className={`p-2 rounded-lg border transition-all flex justify-center ${config.type === t.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                title={t.id}
                            >
                                <t.icon size={16}/>
                            </button>
                        ))}
                    </div>
                </div>

                {isCartesian && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><ZoomIn size={12}/> Data Density (Zoom)</label>
                        <div className="relative pt-1">
                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                                <span>Dense</span>
                                <span className="text-violet-400">{(config.zoomLevel || 1).toFixed(1)}x</span>
                                <span>Wide</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="5.0" 
                                step="0.1" 
                                value={config.zoomLevel || 1}
                                onChange={(e) => onConfigChange({...config, zoomLevel: parseFloat(e.target.value)})}
                                className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-violet-500"
                            />
                        </div>
                    </div>
                )}

                {config.type !== 'kpi' && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <ArrowUpDown size={12} /> Sort Order
                        </label>
                        <div className="relative">
                            <select 
                                value={config.sortBy || 'value_desc'}
                                onChange={(e) => onConfigChange({ ...config, sortBy: e.target.value as any })}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                            >
                                <option value="value_desc">Highest Value First</option>
                                <option value="value_asc">Lowest Value First</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                )}

                {config.type !== 'kpi' && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Hash size={12} /> Limit Items (Top N)
                        </label>
                        <input 
                            type="number" 
                            value={config.limit || ''} 
                            onChange={(e) => onConfigChange({...config, limit: e.target.value ? parseInt(e.target.value) : undefined})}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none placeholder-gray-500"
                            placeholder="All (Auto-scroll)"
                        />
                    </div>
                )}

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Settings size={12}/> Aggregation</label>
                    <div className="relative">
                        <select 
                            value={config.aggregation}
                            onChange={(e) => {
                                const newAgg = e.target.value as any;
                                let newMetrics = config.metricKeys;
                                // Auto-select a numeric metric if none selected and aggregation is not count or none
                                if (newAgg !== 'count' && newAgg !== 'none' && (!newMetrics || newMetrics.length === 0)) {
                                    const firstNum = columns.find(c => c.type === 'number');
                                    if (firstNum) newMetrics = [firstNum.name];
                                }
                                onConfigChange({...config, aggregation: newAgg, metricKeys: newMetrics});
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                        >
                            {AGGREGATION_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                </div>

                {config.type !== 'kpi' && config.type !== 'pie' && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Type size={12}/> Axis Titles</label>
                        <div className="flex flex-col gap-2">
                            <input 
                                type="text" 
                                placeholder="X-Axis Label" 
                                value={config.xAxisLabel || ''} 
                                onChange={(e) => onConfigChange({...config, xAxisLabel: e.target.value})}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none placeholder-gray-500"
                            />
                            <input 
                                type="text" 
                                placeholder="Y-Axis Label" 
                                value={config.yAxisLabel || ''} 
                                onChange={(e) => onConfigChange({...config, yAxisLabel: e.target.value})}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-violet-500 outline-none placeholder-gray-500"
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Filter size={12}/> Data Filters</label>
                        <div className="relative" ref={filterMenuRef}>
                            <button 
                                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)} 
                                className={`text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg border ${isFilterMenuOpen ? 'bg-gray-800 border-gray-600 text-white' : 'border-transparent hover:bg-gray-800'}`}
                            >
                                <Plus size={14}/>
                            </button>
                            {isFilterMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                    <div className="p-2 border-b border-gray-700/50">
                                        <input autoFocus type="text" placeholder="Search columns..." className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        {columns.map(c => (
                                            <button 
                                                key={c.name} 
                                                onClick={() => addFilter(c.name)}
                                                disabled={!!(config.filters && config.filters[c.name])}
                                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 rounded flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="truncate">{c.name}</span>
                                                {c.type === 'number' && <Hash size={10} className="text-gray-500"/>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {config.filters && Object.keys(config.filters).length > 0 ? (
                            Object.entries(config.filters).map(([colName, filterValue]) => {
                                // Fix: Explicitly cast filterValue to FilterConfig to resolve 'unknown' type property access errors
                                const filter = filterValue as FilterConfig;
                                const colInfo = columns.find(c => c.name === colName);
                                const topValues = colInfo?.topValues || [];
                                // Sort values alphanumerically for display
                                const sortedValues = [...topValues].sort((a, b) => 
                                    String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
                                );
                                const isNumber = colInfo?.type === 'number';
                                const activeType = filter.type || 'select'; // Default to select now
                                
                                return (
                                    <div key={colName} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 space-y-3 shadow-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-200">{colName}</span>
                                            <button onClick={() => removeFilter(colName)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={12}/></button>
                                        </div>

                                        {/* Toggle Type if Numeric */}
                                        {isNumber && (
                                            <div className="flex bg-gray-900 p-0.5 rounded-lg border border-gray-700">
                                                <button onClick={() => updateFilterType(colName, 'select')} className={`flex-1 py-1 text-[9px] font-bold rounded uppercase ${activeType === 'select' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Values</button>
                                                <button onClick={() => updateFilterType(colName, 'range')} className={`flex-1 py-1 text-[9px] font-bold rounded uppercase ${activeType === 'range' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Range</button>
                                            </div>
                                        )}

                                        {activeType === 'range' ? (
                                            <div className="flex gap-2 items-center">
                                                <input 
                                                    type="number" 
                                                    placeholder="Min" 
                                                    value={filter.min ?? ''} 
                                                    onChange={(e) => updateRangeFilter(colName, e.target.value, String(filter.max ?? ''))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                                                />
                                                <span className="text-gray-500">-</span>
                                                <input 
                                                    type="number" 
                                                    placeholder="Max" 
                                                    value={filter.max ?? ''} 
                                                    onChange={(e) => updateRangeFilter(colName, String(filter.min ?? ''), e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {/* Bulk Select Controls */}
                                                <div className="flex gap-2 mb-2">
                                                    <button 
                                                        onClick={() => setFilterValues(colName, sortedValues.map(String))}
                                                        className="flex-1 py-1 text-[9px] font-bold bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                                    >
                                                        All
                                                    </button>
                                                    <button 
                                                        onClick={() => setFilterValues(colName, [])}
                                                        className="flex-1 py-1 text-[9px] font-bold bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                                    >
                                                        None
                                                    </button>
                                                </div>
                                                <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                                                    {sortedValues.map(val => {
                                                        const isSelected = filter.selected?.includes(String(val));
                                                        return (
                                                            <label key={String(val)} className="flex items-center gap-2 cursor-pointer group/item hover:bg-gray-900/50 p-1 rounded">
                                                                <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-gray-600 bg-gray-900'}`}>
                                                                    {isSelected && <Check size={8} className="text-white"/>}
                                                                </div>
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="hidden" 
                                                                    checked={isSelected} 
                                                                    onChange={() => toggleFilterValue(colName, String(val))} 
                                                                />
                                                                <span className={`text-[10px] truncate ${isSelected ? 'text-white' : 'text-gray-500 group-hover/item:text-gray-300'}`}>{String(val)}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-[10px] text-gray-600 italic p-3 border border-dashed border-gray-800 rounded-xl text-center">No filters active</div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={12}/> Theme</label>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => onConfigChange({...config, chartColor: undefined})} className={`w-6 h-6 rounded-full border ${!config.chartColor ? 'border-white' : 'border-transparent'} bg-gradient-to-tr from-blue-500 to-pink-500`}/>
                        {NEON_PALETTE.map(c => (
                            <button 
                                key={c}
                                onClick={() => onConfigChange({...config, chartColor: c})}
                                className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${config.chartColor === c ? 'border-white' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Workbench;