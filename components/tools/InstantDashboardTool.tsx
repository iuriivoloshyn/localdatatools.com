
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../App';
import { DashboardViewMode, DashboardSpace, ExtendedWidgetConfig, ExtendedColumnAnalysis } from './dashboard/types';
import { analyzeColumns } from '../../utils/dashboardHelpers';
import { parseCSVLine, detectDelimiter } from '../../utils/csvHelpers';
import { FileData } from '../../types';
import { LayoutDashboard, Table, BarChart2, Layout, Maximize2, Minimize2, X, ChevronRight, Save, Upload, Download, AlertTriangle } from 'lucide-react';

// Shared Components
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';

// Sub Components
import DataView from './dashboard/DataView';
import Workbench from './dashboard/Workbench';
import DashboardCanvas from './dashboard/DashboardCanvas';

const InstantDashboardTool: React.FC = () => {
    const { t } = useLanguage();
    
    // Global State
    const [view, setView] = useState<DashboardViewMode>('data');
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<string[][]>([]);
    const [columns, setColumns] = useState<ExtendedColumnAnalysis[]>([]);
    const [isFullScreen, setIsFullScreen] = useState(false);
    
    const [spaces, setSpaces] = useState<DashboardSpace[]>([
        { id: 'default', name: 'Main Dashboard', widgets: [] }
    ]);
    const [activeSpaceId, setActiveSpaceId] = useState<string>('default');
    
    // Workbench State
    const [draftConfig, setDraftConfig] = useState<ExtendedWidgetConfig | null>(null);
    const [chatHistory, setChatHistory] = useState<{role: 'user'|'model', content: string}[]>([]);

    const configInputRef = useRef<HTMLInputElement>(null);

    // Helpers
    const activeSpace = spaces.find(s => s.id === activeSpaceId) || spaces[0];

    // --- UTILS FOR STATS ---
    const getMedian = (values: number[]) => {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const getMode = (values: number[]) => {
        if (values.length === 0) return 0;
        const counts: Record<number, number> = {};
        let maxCount = 0;
        let mode = values[0];
        for(const v of values) {
            counts[v] = (counts[v] || 0) + 1;
            if(counts[v] > maxCount) {
                maxCount = counts[v];
                mode = v;
            }
        }
        return mode;
    };

    const getVariance = (values: number[]) => {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sqDiffs = values.map(v => Math.pow(v - mean, 2));
        return sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
    };

    const getStdDev = (values: number[]) => Math.sqrt(getVariance(values));

    // Data Processing Helper
    const calculateWidgetData = useCallback((widget: ExtendedWidgetConfig) => {
        // FIX: Allow KPI widgets to calculate global stats without a dimension key
        if (!widget.dataKey && widget.type !== 'kpi') return []; 

        const dataIdx = widget.dataKey ? headers.indexOf(widget.dataKey) : -1;
        // Only return empty if a dataKey was strictly required (non-KPI) but not found
        if (widget.type !== 'kpi' && dataIdx === -1) return [];

        const metrics = widget.metricKeys && widget.metricKeys.length > 0 
            ? widget.metricKeys 
            : (widget.secondaryKey ? [widget.secondaryKey] : []);
            
        const metricIndices = metrics.map(m => headers.indexOf(m));

        const maxRows = 50000;
        const processRows = rows.length > maxRows ? rows.slice(0, maxRows) : rows; 

        // Optimization: Pre-calculate filter indices
        const filterIndices: Record<string, number> = {};
        if (widget.filters) {
            Object.keys(widget.filters).forEach(key => {
                let idx = headers.indexOf(key);
                if (idx === -1) {
                    idx = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
                }
                if (idx !== -1) filterIndices[key] = idx;
            });
        }

        // --- RAW MODE: NO AGGREGATION ---
        if (widget.aggregation === 'none') {
             const results: any[] = [];
             processRows.forEach(row => {
                 // Filter Check (Duplicated for speed)
                 if (widget.filters && Object.keys(widget.filters).length > 0) {
                    for (const [filterKey, filterConfig] of Object.entries(widget.filters)) {
                        const filterIdx = filterIndices[filterKey];
                        if (filterIdx === undefined) continue;
                        let rowVal = row[filterIdx];
                        if (rowVal === undefined || rowVal === null || rowVal.trim() === '') rowVal = '(Blank)';
                        if (filterConfig.type === 'select' && filterConfig.selected && filterConfig.selected.length > 0) {
                            if (!filterConfig.selected.some(s => String(s) === String(rowVal))) return; 
                        }
                        if (filterConfig.type === 'range') {
                            const numVal = parseFloat(rowVal.replace(/[^0-9.-]/g, ''));
                            if (!isNaN(numVal)) {
                                if (filterConfig.min !== undefined && numVal < filterConfig.min) return;
                                if (filterConfig.max !== undefined && numVal > filterConfig.max) return;
                            } else return; 
                        }
                    }
                 }

                 // Extraction
                 let key = dataIdx !== -1 ? row[dataIdx] : 'Row';
                 if (key === undefined || key === null || key.trim() === '') key = '(Blank)';
                 
                 const item: any = { name: key };
                 
                 if (metrics.length > 0) {
                     metrics.forEach((m, i) => {
                         const idx = metricIndices[i];
                         if (idx !== -1) {
                             const rawVal = row[idx];
                             const val = parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                             item[m] = isNaN(val) ? 0 : val;
                         }
                     });
                     item.value = item[metrics[0]];
                 } else {
                     item.value = 1; 
                 }
                 results.push(item);
             });
             return results;
        }

        // --- AGGREGATION MODE ---
        const agg: Record<string, { 
            count: number, 
            metricValues: Record<string, number[]>, 
            uniqueSets: Record<string, Set<string>> 
        }> = {};
        
        processRows.forEach(row => {
            // 1. Filter Check
            if (widget.filters && Object.keys(widget.filters).length > 0) {
                for (const [filterKey, filterConfig] of Object.entries(widget.filters)) {
                    const filterIdx = filterIndices[filterKey];
                    if (filterIdx === undefined) continue;
                    
                    let rowVal = row[filterIdx];
                    if (rowVal === undefined || rowVal === null || rowVal.trim() === '') {
                        rowVal = '(Blank)';
                    }
                    
                    if (filterConfig.type === 'select' && filterConfig.selected && filterConfig.selected.length > 0) {
                        // Strict check, ensuring types match (usually string from CSV)
                        if (!filterConfig.selected.some(s => String(s) === String(rowVal))) return; 
                    }
                    if (filterConfig.type === 'range') {
                        const numVal = parseFloat(rowVal.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(numVal)) {
                            if (filterConfig.min !== undefined && numVal < filterConfig.min) return;
                            if (filterConfig.max !== undefined && numVal > filterConfig.max) return;
                        } else {
                            return; 
                        }
                    }
                }
            }

            // 2. Grouping
            let key = 'Total'; // Default key for global aggregation
            if (dataIdx !== -1) {
                key = row[dataIdx];
                if (key === undefined || key === null || key.trim() === '') {
                    key = '(Blank)';
                }
            }
            
            if (!agg[key]) agg[key] = { count: 0, metricValues: {}, uniqueSets: {} };
            
            agg[key].count++;
            
            // Collect metric values
            metricIndices.forEach((idx, i) => {
                if (idx !== -1) {
                    const metricName = metrics[i];
                    const rawVal = row[idx];
                    
                    if (!agg[key].uniqueSets[metricName]) agg[key].uniqueSets[metricName] = new Set();
                    if (rawVal !== undefined && rawVal !== null) agg[key].uniqueSets[metricName].add(rawVal);

                    if (rawVal !== undefined && rawVal !== null && rawVal.trim() !== '') {
                        const val = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(val)) {
                            if (!agg[key].metricValues[metricName]) agg[key].metricValues[metricName] = [];
                            agg[key].metricValues[metricName].push(val);
                        }
                    }
                }
            });
        });

        // 3. Compute Final Stats
        const computeStat = (values: number[], uniqueSet: Set<string>, type: string) => {
            switch(type) {
                case 'sum': return values.reduce((a, b) => a + b, 0);
                case 'avg': return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                case 'min': return values.length > 0 ? Math.min(...values) : 0;
                case 'max': return values.length > 0 ? Math.max(...values) : 0;
                case 'median': return getMedian(values);
                case 'mode': return getMode(values);
                case 'stddev': return getStdDev(values);
                case 'variance': return getVariance(values);
                case 'distinct': return uniqueSet.size;
                default: return values.length; // Count
            }
        };

        // KPI Special Case
        if (widget.type === 'kpi') {
            const firstMetric = metrics[0];
            if (!firstMetric) return Object.values(agg).reduce((a, b) => a + b.count, 0);

            const allValues: number[] = [];
            const allUnique = new Set<string>();
            
            Object.values(agg).forEach(group => {
                if(group.metricValues[firstMetric]) allValues.push(...group.metricValues[firstMetric]);
                if(group.uniqueSets[firstMetric]) group.uniqueSets[firstMetric].forEach(v => allUnique.add(v));
            });

            return computeStat(allValues, allUnique, widget.aggregation);
        }

        // Chart Data Mapping
        return Object.entries(agg).map(([k, v]) => {
            const item: any = { name: k };
            
            if (metrics.length > 0) {
                metrics.forEach(m => {
                    if (widget.aggregation === 'count') {
                        item[m] = v.count;
                    } else {
                        const vals = v.metricValues[m] || [];
                        const unq = v.uniqueSets[m] || new Set();
                        item[m] = computeStat(vals, unq, widget.aggregation);
                    }
                });
                item.value = item[metrics[0]]; 
            } else {
                item.value = v.count;
                item['Count'] = v.count; 
            }
            
            return item;
        });
    }, [headers, rows]);

    // Handlers
    const handleFileLoad = async (data: FileData) => {
        const text = await data.file.text();
        const delimiter = detectDelimiter(text);
        const allLines = text.split(/\r?\n/).filter(l => l.trim());
        const headerRow = parseCSVLine(allLines[0], delimiter);
        const dataRows = allLines.slice(1).map(l => parseCSVLine(l, delimiter));
        
        setFileData(data);
        setHeaders(headerRow);
        setRows(dataRows);
        
        const rowObjects = dataRows.slice(0, 1000).map(r => {
            const obj: any = {};
            headerRow.forEach((h, i) => obj[h] = r[i]);
            return obj;
        });
        const analysis = analyzeColumns(rowObjects, headerRow) as ExtendedColumnAnalysis[];
        setColumns(analysis);
    };

    const handleSaveDashboard = () => {
        const configToSave = {
            version: 1,
            timestamp: Date.now(),
            sourceFileName: fileData?.file.name,
            headers: headers, 
            spaces: spaces,
            activeSpaceId: activeSpaceId
        };

        const blob = new Blob([JSON.stringify(configToSave, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard_layout_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleLoadDashboard = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string);
                
                if (config.headers) {
                    const currentHeadersJson = JSON.stringify([...headers].sort());
                    const configHeadersJson = JSON.stringify([...config.headers].sort());
                    
                    if (currentHeadersJson !== configHeadersJson) {
                        if (!window.confirm("Column mismatch detected!\nThe saved layout was built for a different CSV structure. Charts may be broken.\n\nDo you still want to load it?")) {
                            if (configInputRef.current) configInputRef.current.value = '';
                            return;
                        }
                    }
                }

                if (config.spaces) setSpaces(config.spaces);
                if (config.activeSpaceId) setActiveSpaceId(config.activeSpaceId);
                
                setView('canvas'); 
                alert("Dashboard layout loaded successfully!");

            } catch (err) {
                console.error(err);
                alert("Failed to load dashboard configuration. Invalid file format.");
            } finally {
                if (configInputRef.current) configInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSaveWidget = (config: ExtendedWidgetConfig) => {
        setSpaces(prev => prev.map(s => {
            if (s.id === activeSpaceId) {
                const exists = s.widgets.find(w => w.id === config.id);
                if (exists) {
                    return { ...s, widgets: s.widgets.map(w => w.id === config.id ? config : w) };
                }
                
                let newY = 0;
                if (s.widgets.length > 0) {
                    const maxY = Math.max(...s.widgets.map(w => w.layout.y + w.layout.h));
                    newY = maxY + 10;
                }
                
                const newWidget = {
                    ...config,
                    layout: { ...config.layout, x: 0, y: newY }
                };
                
                return { ...s, widgets: [...s.widgets, newWidget] };
            }
            return s;
        }));
        
        setDraftConfig(null);
        setView('canvas');
    };

    const handleEditWidget = (id: string) => {
        const widget = activeSpace.widgets.find(w => w.id === id);
        if (widget) {
            setDraftConfig({ ...widget });
            setChatHistory([]);
            setView('workbench');
        }
    };

    const handleSwitchView = (newView: DashboardViewMode) => {
        if (newView === 'workbench' && !draftConfig) {
            setDraftConfig({
                id: Math.random().toString(36).substr(2, 9),
                type: 'bar',
                title: 'New Chart',
                dataKey: '',
                metricKeys: [],
                aggregation: 'count',
                colSpan: 2,
                layout: { x: 0, y: 0, w: 600, h: 400, zIndex: 10 }
            });
            setChatHistory([]);
        }
        setView(newView);
    };

    const handleAddWidget = () => {
        handleSwitchView('workbench');
    };

    const handleDeleteWidget = (id: string) => {
        setSpaces(prev => prev.map(s => ({
            ...s,
            widgets: s.widgets.filter(w => w.id !== id)
        })));
    };

    const handleMoveWidget = (id: string, layout: any) => {
        setSpaces(prev => prev.map(s => ({
            ...s,
            widgets: s.widgets.map(w => w.id === id ? { ...w, layout } : w)
        })));
    };

    const handleReset = () => {
        setFileData(null);
        setHeaders([]);
        setRows([]);
        setColumns([]);
        setSpaces([{ id: 'default', name: 'Main Dashboard', widgets: [] }]);
        setDraftConfig(null);
        setChatHistory([]);
        setView('data');
        setIsFullScreen(false);
    };

    const isFixedLayout = view === 'canvas' || view === 'data';
    const isWorkbench = view === 'workbench';

    const content = (
        <div className={`flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999] bg-[#0d0d0d]/95 p-4 animate-in fade-in duration-300 overflow-hidden' : ''}`}>
            {!isFullScreen && (
                <div className="shrink-0">
                    <ToolHeader 
                        title="Dashboard" 
                        description="Turn any CSV into an interactive BI dashboard in seconds. Visualize trends, filter data, and build charts with AI assistance."
                        instructions={[
                            "Upload a CSV file to begin analysis",
                            "Use the 'Chart' tab to create visualizations with drag-and-drop or AI",
                            "Organize and resize widgets on the 'Dashboard' canvas",
                            "Save your layout to JSON and restore it later on similar CSVs"
                        ]}
                        icon={LayoutDashboard}
                        colorClass="text-violet-400"
                        onReset={handleReset}
                        badge="Alpha"
                    />
                </div>
            )}

            {!fileData ? (
                <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2">
                    <FileUploader 
                        onFileLoaded={handleFileLoad} 
                        disabled={false}
                        theme="violet"
                        limitText="Large files supported. Local processing."
                        accept=".csv"
                    />
                </div>
            ) : (
                <div className={`flex flex-col bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl animate-in fade-in ${
                    isFullScreen 
                        ? 'rounded-none border-0 h-full overflow-hidden' 
                        : isFixedLayout 
                            ? 'mb-32 h-[calc(100vh-220px)] min-h-[600px] overflow-hidden' 
                            : 'mb-32 min-h-[600px] overflow-hidden' // Workbench (Normal Mode) -> Auto height but clipped corners
                }`}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                                <button 
                                    onClick={() => handleSwitchView('data')} 
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${view === 'data' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <Table size={14} /> Data
                                </button>
                                <button 
                                    onClick={() => handleSwitchView('workbench')} 
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${view === 'workbench' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <BarChart2 size={14} /> Chart
                                </button>
                                <button 
                                    onClick={() => handleSwitchView('canvas')} 
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${view === 'canvas' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <Layout size={14} /> Dashboard
                                </button>
                            </div>
                            <div className="h-6 w-px bg-gray-800"></div>
                            <span className="text-xs font-medium text-gray-400 truncate max-w-[200px]">{fileData.file.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Load/Save Controls - Only show in Canvas mode */}
                            {view === 'canvas' && (
                                <>
                                    <input 
                                        type="file" 
                                        ref={configInputRef} 
                                        accept=".json" 
                                        className="hidden" 
                                        onChange={handleLoadDashboard} 
                                    />
                                    <button 
                                        onClick={() => configInputRef.current?.click()}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                                        title="Load Saved Layout"
                                    >
                                        <Upload size={16} />
                                        <span className="text-xs font-bold hidden sm:inline">Load</span>
                                    </button>
                                    <button 
                                        onClick={handleSaveDashboard}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                                        title="Save Layout to JSON"
                                    >
                                        <Save size={16} />
                                        <span className="text-xs font-bold hidden sm:inline">Save</span>
                                    </button>
                                    <div className="h-6 w-px bg-gray-800 mx-1"></div>
                                </>
                            )}

                            <button 
                                onClick={() => setIsFullScreen(!isFullScreen)} 
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                            >
                                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className={`flex-1 relative bg-[#0d0d0d] ${
                        (isFullScreen && isWorkbench) ? 'overflow-y-auto custom-scrollbar' : // Fullscreen Workbench needs scroll
                        isFixedLayout ? 'overflow-hidden' : '' // Fixed views manage their own scroll/pan
                    }`}>
                        {view === 'data' && (
                            <DataView 
                                file={fileData.file} 
                                headers={headers} 
                                rows={rows} 
                                onNext={() => handleSwitchView('workbench')} 
                            />
                        )}
                        {view === 'workbench' && draftConfig && (
                            <Workbench 
                                config={draftConfig}
                                onConfigChange={setDraftConfig}
                                columns={columns}
                                data={[]} 
                                onCalculateData={calculateWidgetData}
                                onSaveToDashboard={handleSaveWidget}
                                onCancel={() => { }}
                                chatHistory={chatHistory}
                                setChatHistory={setChatHistory}
                            />
                        )}
                        {view === 'canvas' && (
                            <DashboardCanvas 
                                space={activeSpace}
                                onEditWidget={handleEditWidget}
                                onDeleteWidget={handleDeleteWidget}
                                onMoveWidget={handleMoveWidget}
                                onBackToData={() => handleSwitchView('data')}
                                onAddWidget={handleAddWidget}
                                getWidgetData={calculateWidgetData}
                                isFullScreen={isFullScreen}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    if (isFullScreen) {
        return createPortal(content, document.body);
    }

    return content;
};

export default InstantDashboardTool;
