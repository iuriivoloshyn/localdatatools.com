
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ExtendedWidgetConfig, DashboardSpace, SnapLine } from './types';
import { KpiWidget, ChartWidget } from './DashboardWidgets';
import { Download, Minimize2, Maximize2, Trash2, Edit3, Move, Plus, Minus, RotateCcw, ArrowDownRight, AlertTriangle, X, Archive, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { DEFAULT_GAP } from './constants';

interface DashboardCanvasProps {
    space: DashboardSpace;
    onEditWidget: (widgetId: string) => void;
    onDeleteWidget: (widgetId: string) => void;
    onMoveWidget: (widgetId: string, layout: any) => void;
    onBackToData: () => void;
    onAddWidget: () => void;
    getWidgetData: (widget: ExtendedWidgetConfig) => any;
    isFullScreen?: boolean;
}

const SNAP_THRESHOLD = 15;

// Memoized Wrapper
const SmartWidgetWrapper = React.memo(({ 
    widget, 
    getWidgetData, 
    onAction 
}: { 
    widget: ExtendedWidgetConfig, 
    getWidgetData: (w: ExtendedWidgetConfig) => any,
    onAction: (type: 'edit' | 'delete', id: string) => void
}) => {
    const data = useMemo(() => getWidgetData(widget), [widget.dataKey, widget.metricKeys, widget.secondaryKey, widget.aggregation, widget.limit, JSON.stringify(widget.filters), getWidgetData]);

    return (
        <>
            {/* Controls Overlay */}
            <div className="absolute -top-4 right-2 flex gap-2 z-[60] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
                <button
                    className="p-2 bg-gray-900 border border-white/20 rounded-lg text-blue-400 hover:bg-white/10 hover:border-blue-500/50 shadow-xl transition-all cursor-pointer hover:scale-110 active:scale-95"
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => { e.stopPropagation(); onAction('edit', widget.id); }}
                    title="Edit Widget"
                >
                    <Edit3 size={14} />
                </button>
                <button
                    className="p-2 bg-gray-900 border border-white/20 rounded-lg text-red-400 hover:bg-white/10 hover:border-red-500/50 shadow-xl transition-all cursor-pointer hover:scale-110 active:scale-95"
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => { e.stopPropagation(); onAction('delete', widget.id); }}
                    title="Delete Widget"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Content */}
            <div id={`widget-${widget.id}`} className="w-full h-full shadow-2xl rounded-2xl overflow-hidden bg-gray-900/60 backdrop-blur border border-white/5 hover:border-violet-500/30 transition-colors pointer-events-none">
                <div className="w-full h-full pointer-events-auto">
                    {widget.type === 'kpi' ? (
                        <KpiWidget config={widget} value={typeof data === 'number' ? data : 0} /> 
                    ) : (
                        <ChartWidget config={widget} data={Array.isArray(data) ? data : []} />
                    )}
                </div>
            </div>
        </>
    );
}, (prev, next) => {
    return prev.widget === next.widget && prev.getWidgetData === next.getWidgetData;
});

const DashboardCanvas: React.FC<DashboardCanvasProps> = ({ space, onEditWidget, onDeleteWidget, onMoveWidget, onBackToData, onAddWidget, getWidgetData, isFullScreen }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null); 
    const [panZoom, setPanZoom] = useState({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [draggingWidget, setDraggingWidget] = useState<string | null>(null);
    const [resizingWidget, setResizingWidget] = useState<string | null>(null);
    const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
    const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
    const resizeRef = useRef({ startX: 0, startY: 0, initialW: 0, initialH: 0 });
    const panRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    // --- STABLE HANDLER PATTERN ---
    const handlersRef = useRef({ onEditWidget, onDeleteWidget });
    handlersRef.current = { onEditWidget, onDeleteWidget };

    const stableOnAction = useCallback((type: 'edit' | 'delete', id: string) => {
        if (type === 'edit') handlersRef.current.onEditWidget(id);
        if (type === 'delete') setDeleteCandidateId(id);
    }, []);

    const confirmDelete = () => {
        if (deleteCandidateId) {
            handlersRef.current.onDeleteWidget(deleteCandidateId);
            setDeleteCandidateId(null);
        }
    };

    // --- FIT CONTENT LOGIC ---
    const handleFitContent = useCallback(() => {
        if (!parentRef.current) return;

        // Force a layout read to ensure we have dimensions
        const { width: containerW, height: containerH } = parentRef.current.getBoundingClientRect();
        
        if (space.widgets.length === 0) {
            setPanZoom({ x: 0, y: 0, scale: 1 });
            return;
        }

        const PADDING = 100;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        space.widgets.forEach(w => {
            minX = Math.min(minX, w.layout.x);
            maxX = Math.max(maxX, w.layout.x + w.layout.w);
            minY = Math.min(minY, w.layout.y);
            maxY = Math.max(maxY, w.layout.y + w.layout.h);
        });

        // Safety fallback if widgets are invalid or not placed yet
        if (minX === Infinity) {
             setPanZoom({ x: 0, y: 0, scale: 1 });
             return;
        }

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const contentCenterX = minX + contentW / 2;
        const contentCenterY = minY + contentH / 2;

        // Calculate Scale to fit
        const scaleX = (containerW - PADDING * 2) / Math.max(contentW, 100);
        const scaleY = (containerH - PADDING * 2) / Math.max(contentH, 100);
        const newScale = Math.min(Math.min(scaleX, scaleY), 1); 

        // Center the content bounding box
        const newX = (containerW / 2) - (contentCenterX * newScale);
        const newY = (containerH / 2) - (contentCenterY * newScale);

        setPanZoom({ x: newX, y: newY, scale: newScale });
    }, [space.widgets]);

    // Robust mount effect: use requestAnimationFrame to ensure DOM is painted
    useEffect(() => {
        let rafId: number;
        const initFit = () => {
            if (parentRef.current && parentRef.current.offsetWidth > 0) {
                handleFitContent();
            } else {
                rafId = requestAnimationFrame(initFit);
            }
        };
        rafId = requestAnimationFrame(initFit);
        return () => cancelAnimationFrame(rafId);
    }, []); // Run once on mount

    // Center-based Zoom
    const handleZoom = (delta: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.parentElement?.getBoundingClientRect();
        if (!rect) return;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        setPanZoom(prev => {
            const newScale = Math.min(Math.max(0.1, prev.scale + delta), 4);
            const scaleRatio = newScale / prev.scale;
            const newX = centerX - (centerX - prev.x) * scaleRatio;
            const newY = centerY - (centerY - prev.y) * scaleRatio;
            return { x: newX, y: newY, scale: newScale };
        });
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isFullScreen) return;
        e.stopPropagation();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        handleZoom(delta);
    };

    // Pan Handlers
    const handlePanStart = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('.widget-card')) return;
        setIsPanning(true);
        panRef.current = { startX: e.clientX, startY: e.clientY, initialX: panZoom.x, initialY: panZoom.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePanMove = (e: React.PointerEvent) => {
        if (isPanning) {
            const dx = e.clientX - panRef.current.startX;
            const dy = e.clientY - panRef.current.startY;
            setPanZoom(prev => ({ ...prev, x: panRef.current.initialX + dx, y: panRef.current.initialY + dy }));
        } else if (draggingWidget) {
            handleWidgetDrag(e);
        } else if (resizingWidget) {
            handleWidgetResize(e);
        }
    };

    const handlePanEnd = (e: React.PointerEvent) => {
        setIsPanning(false);
        setDraggingWidget(null);
        setResizingWidget(null);
        setSnapLines([]);
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (e) { }
    };

    const handleWidgetDragStart = (e: React.PointerEvent, widgetId: string) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.resize-handle')) return;
        e.stopPropagation();
        const widget = space.widgets.find(w => w.id === widgetId);
        if (widget) {
            setDraggingWidget(widgetId);
            dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: widget.layout.x, initialY: widget.layout.y };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handleWidgetDrag = (e: React.PointerEvent) => {
        if (!draggingWidget) return;
        const activeWidget = space.widgets.find(w => w.id === draggingWidget);
        if (!activeWidget) return;

        const dx = (e.clientX - dragRef.current.startX) / panZoom.scale;
        const dy = (e.clientY - dragRef.current.startY) / panZoom.scale;
        
        let newX = dragRef.current.initialX + dx;
        let newY = dragRef.current.initialY + dy;

        const activeRect = {
            l: newX, r: newX + activeWidget.layout.w, cx: newX + activeWidget.layout.w / 2,
            t: newY, b: newY + activeWidget.layout.h, cy: newY + activeWidget.layout.h / 2
        };

        const newSnapLines: SnapLine[] = [];
        
        space.widgets.forEach(neighbor => {
            if (neighbor.id === draggingWidget) return;

            const nRect = {
                l: neighbor.layout.x, r: neighbor.layout.x + neighbor.layout.w, cx: neighbor.layout.x + neighbor.layout.w / 2,
                t: neighbor.layout.y, b: neighbor.layout.y + neighbor.layout.h, cy: neighbor.layout.y + neighbor.layout.h / 2
            };

            // Edge Snapping (Violet)
            if (Math.abs(activeRect.l - nRect.l) < SNAP_THRESHOLD) { newX = nRect.l; newSnapLines.push({ orientation: 'vertical', position: nRect.l, start: Math.min(activeRect.t, nRect.t), end: Math.max(activeRect.b, nRect.b) }); }
            else if (Math.abs(activeRect.r - nRect.r) < SNAP_THRESHOLD) { newX = nRect.r - activeWidget.layout.w; newSnapLines.push({ orientation: 'vertical', position: nRect.r, start: Math.min(activeRect.t, nRect.t), end: Math.max(activeRect.b, nRect.b) }); }
            else if (Math.abs(activeRect.l - nRect.r) < SNAP_THRESHOLD) { newX = nRect.r; newSnapLines.push({ orientation: 'vertical', position: nRect.r, start: Math.min(activeRect.t, nRect.t), end: Math.max(activeRect.b, nRect.b) }); }
            else if (Math.abs(activeRect.r - nRect.l) < SNAP_THRESHOLD) { newX = nRect.l - activeWidget.layout.w; newSnapLines.push({ orientation: 'vertical', position: nRect.l, start: Math.min(activeRect.t, nRect.t), end: Math.max(activeRect.b, nRect.b) }); }

            // Center Snapping (Emerald)
            if (Math.abs(activeRect.cx - nRect.cx) < SNAP_THRESHOLD) { newX = nRect.cx - activeWidget.layout.w / 2; newSnapLines.push({ orientation: 'vertical', position: nRect.cx, start: Math.min(activeRect.t, nRect.t), end: Math.max(activeRect.b, nRect.b), type: 'center' }); }

            // Gap Snapping (Cyan)
            if (Math.abs(activeRect.l - (nRect.r + DEFAULT_GAP)) < SNAP_THRESHOLD) { newX = nRect.r + DEFAULT_GAP; newSnapLines.push({ orientation: 'vertical', position: newX, start: activeRect.t, end: activeRect.b, type: 'gap' }); }
            else if (Math.abs(activeRect.r - (nRect.l - DEFAULT_GAP)) < SNAP_THRESHOLD) { newX = nRect.l - DEFAULT_GAP - activeWidget.layout.w; newSnapLines.push({ orientation: 'vertical', position: newX + activeWidget.layout.w, start: activeRect.t, end: activeRect.b, type: 'gap' }); }

            // Horizontal Snapping
            if (Math.abs(activeRect.t - nRect.t) < SNAP_THRESHOLD) { newY = nRect.t; newSnapLines.push({ orientation: 'horizontal', position: nRect.t, start: Math.min(activeRect.l, nRect.l), end: Math.max(activeRect.r, nRect.r) }); }
            else if (Math.abs(activeRect.b - nRect.b) < SNAP_THRESHOLD) { newY = nRect.b - activeWidget.layout.h; newSnapLines.push({ orientation: 'horizontal', position: nRect.b, start: Math.min(activeRect.l, nRect.l), end: Math.max(activeRect.r, nRect.r) }); }
            else if (Math.abs(activeRect.t - nRect.b) < SNAP_THRESHOLD) { newY = nRect.b; newSnapLines.push({ orientation: 'horizontal', position: nRect.b, start: Math.min(activeRect.l, nRect.l), end: Math.max(activeRect.r, nRect.r) }); }
            else if (Math.abs(activeRect.b - nRect.t) < SNAP_THRESHOLD) { newY = nRect.t - activeWidget.layout.h; newSnapLines.push({ orientation: 'horizontal', position: nRect.t, start: Math.min(activeRect.l, nRect.l), end: Math.max(activeRect.r, nRect.r) }); }

            // Horizontal Center
            if (Math.abs(activeRect.cy - nRect.cy) < SNAP_THRESHOLD) { newY = nRect.cy - activeWidget.layout.h / 2; newSnapLines.push({ orientation: 'horizontal', position: nRect.cy, start: Math.min(activeRect.l, nRect.l), end: Math.max(activeRect.r, nRect.r), type: 'center' }); }

            // Horizontal Gap
            if (Math.abs(activeRect.t - (nRect.b + DEFAULT_GAP)) < SNAP_THRESHOLD) { newY = nRect.b + DEFAULT_GAP; newSnapLines.push({ orientation: 'horizontal', position: newY, start: activeRect.l, end: activeRect.r, type: 'gap' }); }
            else if (Math.abs(activeRect.b - (nRect.t - DEFAULT_GAP)) < SNAP_THRESHOLD) { newY = nRect.t - DEFAULT_GAP - activeWidget.layout.h; newSnapLines.push({ orientation: 'horizontal', position: newY + activeWidget.layout.h, start: activeRect.l, end: activeRect.r, type: 'gap' }); }
        });

        setSnapLines(newSnapLines);
        onMoveWidget(draggingWidget, { ...activeWidget.layout, x: Math.round(newX), y: Math.round(newY) });
    };

    const handleWidgetResizeStart = (e: React.PointerEvent, widgetId: string) => {
        e.stopPropagation();
        e.preventDefault();
        const widget = space.widgets.find(w => w.id === widgetId);
        if (widget) {
            setResizingWidget(widgetId);
            resizeRef.current = { startX: e.clientX, startY: e.clientY, initialW: widget.layout.w, initialH: widget.layout.h };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handleWidgetResize = (e: React.PointerEvent) => {
        if (!resizingWidget) return;
        const widget = space.widgets.find(w => w.id === resizingWidget);
        if (!widget) return;

        const dx = (e.clientX - resizeRef.current.startX) / panZoom.scale;
        const dy = (e.clientY - resizeRef.current.startY) / panZoom.scale;

        let newW = Math.max(200, resizeRef.current.initialW + dx);
        let newH = Math.max(150, resizeRef.current.initialH + dy);

        // Snap Logic for Resize
        const newSnapLines: SnapLine[] = [];
        const rightEdge = widget.layout.x + newW;
        const bottomEdge = widget.layout.y + newH;

        space.widgets.forEach(neighbor => {
            if (neighbor.id === resizingWidget) return;
            const nRight = neighbor.layout.x + neighbor.layout.w;
            const nBottom = neighbor.layout.y + neighbor.layout.h;
            const nCx = neighbor.layout.x + neighbor.layout.w / 2;
            const nCy = neighbor.layout.y + neighbor.layout.h / 2;

            if (Math.abs(rightEdge - nRight) < SNAP_THRESHOLD) { newW = nRight - widget.layout.x; newSnapLines.push({ orientation: 'vertical', position: nRight, start: Math.min(widget.layout.y, neighbor.layout.y), end: Math.max(bottomEdge, nBottom) }); }
            else if (Math.abs(rightEdge - neighbor.layout.x) < SNAP_THRESHOLD) { newW = neighbor.layout.x - widget.layout.x; newSnapLines.push({ orientation: 'vertical', position: neighbor.layout.x, start: Math.min(widget.layout.y, neighbor.layout.y), end: Math.max(bottomEdge, nBottom) }); }
            else if (Math.abs(rightEdge - nCx) < SNAP_THRESHOLD) { newW = nCx - widget.layout.x; newSnapLines.push({ orientation: 'vertical', position: nCx, start: Math.min(widget.layout.y, neighbor.layout.y), end: Math.max(bottomEdge, nBottom), type: 'center' }); }

            if (Math.abs(bottomEdge - nBottom) < SNAP_THRESHOLD) { newH = nBottom - widget.layout.y; newSnapLines.push({ orientation: 'horizontal', position: nBottom, start: Math.min(widget.layout.x, neighbor.layout.x), end: Math.max(rightEdge, nRight) }); }
            else if (Math.abs(bottomEdge - neighbor.layout.y) < SNAP_THRESHOLD) { newH = neighbor.layout.y - widget.layout.y; newSnapLines.push({ orientation: 'horizontal', position: neighbor.layout.y, start: Math.min(widget.layout.x, neighbor.layout.x), end: Math.max(rightEdge, nRight) }); }
            else if (Math.abs(bottomEdge - nCy) < SNAP_THRESHOLD) { newH = nCy - widget.layout.y; newSnapLines.push({ orientation: 'horizontal', position: nCy, start: Math.min(widget.layout.x, neighbor.layout.x), end: Math.max(rightEdge, nRight), type: 'center' }); }
        });

        setSnapLines(newSnapLines);
        onMoveWidget(resizingWidget, { ...widget.layout, w: Math.round(newW), h: Math.round(newH) });
    };

    const handleDownloadZip = async () => {
        if (space.widgets.length === 0) return;
        setIsDownloading(true);

        const zip = new JSZip();
        const folder = zip.folder("dashboard_charts");
        
        for (const widget of space.widgets) {
            const element = document.getElementById(`widget-${widget.id}`);
            if (!element) continue;
            
            const clone = element.cloneNode(true) as HTMLElement;
            document.body.appendChild(clone);
            
            // Isolate for capture
            clone.style.position = 'fixed';
            clone.style.top = '0';
            clone.style.left = '0';
            clone.style.zIndex = '-9999';
            clone.style.transition = 'none';
            clone.style.transform = 'none';
            clone.style.borderRadius = '0';
            clone.style.height = `${element.offsetHeight}px`; // Match visible height initially
            
            // Fix header truncation for capture by forcing full display
            const titles = clone.querySelectorAll('h3 span.truncate');
            titles.forEach((el) => {
                (el as HTMLElement).style.whiteSpace = 'normal';
                (el as HTMLElement).style.overflow = 'visible';
                (el as HTMLElement).style.textOverflow = 'clip';
                el.classList.remove('truncate');
            });

            // Find scroll container to expand width
            const scrollContainer = clone.querySelector('.overflow-x-auto') as HTMLElement;
            if (scrollContainer) {
                // Determine the necessary width from SVG
                const svg = scrollContainer.querySelector('svg');
                if (svg) {
                    const svgWidth = svg.getAttribute('width');
                    if (svgWidth) {
                        const widthPx = parseInt(svgWidth);
                        // Force the scroll container to be fully wide
                        scrollContainer.style.overflow = 'visible';
                        scrollContainer.style.width = `${widthPx + 100}px`; 
                        
                        // Expand the entire card width to accommodate the chart
                        clone.style.width = `${Math.max(element.offsetWidth, widthPx + 100)}px`;
                    }
                }
            } else {
                clone.style.width = `${element.offsetWidth}px`;
            }
            
            try {
                // Wait for styles
                await new Promise(r => setTimeout(r, 50));
                
                const canvas = await html2canvas(clone, { 
                    scale: 2, 
                    backgroundColor: '#111827',
                    logging: false,
                    useCORS: true
                });
                
                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                if (blob) {
                    const safeTitle = (widget.title || 'chart').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    // Append ID to ensure unique filenames in ZIP if titles are identical
                    folder?.file(`${safeTitle}_${widget.id}.png`, blob);
                }
            } catch (e) {
                console.error("Failed to capture widget", widget.id, e);
            } finally {
                document.body.removeChild(clone);
            }
        }
        
        try {
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard_charts_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Failed to zip", e);
            alert("Failed to create download package.");
        } finally {
            setIsDownloading(false);
        }
    };

    const getLineColor = (type?: 'gap' | 'align' | 'center') => {
        if (type === 'gap') return 'bg-cyan-400';
        if (type === 'center') return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
        return 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]';
    };

    return (
        <div 
            ref={parentRef}
            className="w-full h-full relative bg-[#0d0d0d] overflow-hidden" 
            onWheel={handleWheel}
        >
            {/* Delete Confirmation Modal - Using Portal */}
            {deleteCandidateId && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-4 text-red-400">
                            <div className="p-3 bg-red-500/10 rounded-full">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Delete Widget?</h3>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Are you sure you want to remove this widget from the dashboard? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setDeleteCandidateId(null)}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-6 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all active:scale-95"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-50 flex gap-2 pointer-events-none">
                <div className="flex gap-2 pointer-events-auto bg-gray-900/80 backdrop-blur border border-white/10 p-2 rounded-xl">
                    <button onClick={onAddWidget} className="p-2 hover:bg-white/10 rounded-lg text-emerald-400 transition-colors" title="Add Widget"><Plus size={18}/></button>
                    <div className="w-px h-6 bg-white/10"></div>
                    <button onClick={() => handleZoom(-0.1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"><Minus size={18}/></button>
                    <button onClick={() => handleZoom(0.1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"><Plus size={18}/></button>
                    <button onClick={handleFitContent} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors" title="Fit to Screen"><RotateCcw size={18}/></button>
                    <div className="w-px h-6 bg-white/10"></div>
                    <button 
                        onClick={handleDownloadZip} 
                        disabled={isDownloading}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50" 
                        title="Download All Charts (ZIP)"
                    >
                        {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18}/>}
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div 
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onPointerDown={handlePanStart}
                onPointerMove={handlePanMove}
                onPointerUp={handlePanEnd}
                onPointerLeave={handlePanEnd}
            >
                <div 
                    ref={containerRef}
                    className="absolute top-0 left-0 origin-top-left will-change-transform"
                    style={{ transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})` }}
                >
                    {snapLines.map((line, i) => (
                        <div 
                            key={i}
                            className={`absolute z-[100] ${getLineColor(line.type as any)}`}
                            style={{
                                left: line.orientation === 'vertical' ? line.position : line.start,
                                top: line.orientation === 'horizontal' ? line.position : line.start,
                                width: line.orientation === 'vertical' ? '1px' : (line.end - line.start) + 'px',
                                height: line.orientation === 'horizontal' ? '1px' : (line.end - line.start) + 'px',
                            }}
                        />
                    ))}

                    {space.widgets.map(widget => (
                        <div
                            key={widget.id}
                            className="absolute widget-card group cursor-move"
                            style={{
                                left: widget.layout.x,
                                top: widget.layout.y,
                                width: widget.layout.w,
                                height: widget.layout.h,
                                zIndex: widget.layout.zIndex
                            }}
                            onPointerDown={(e) => handleWidgetDragStart(e, widget.id)}
                        >
                            <SmartWidgetWrapper 
                                widget={widget}
                                getWidgetData={getWidgetData}
                                onAction={stableOnAction}
                            />

                            {/* Resize Handle */}
                            <div 
                                className="resize-handle absolute bottom-0 right-0 p-2 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-[70] hover:bg-white/5 rounded-tl-xl pointer-events-auto"
                                onPointerDown={(e) => handleWidgetResizeStart(e, widget.id)}
                            >
                                <ArrowDownRight size={16} className="text-gray-500" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardCanvas;
