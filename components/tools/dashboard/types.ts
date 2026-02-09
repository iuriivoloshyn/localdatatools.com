
import { WidgetConfig, ColumnAnalysis } from '../../../utils/dashboardHelpers';

export interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    zIndex: number;
}

export interface FilterConfig {
    type: 'select' | 'range';
    selected?: string[];
    min?: number;
    max?: number;
}

export type AggregationType = 'none' | 'count' | 'sum' | 'avg' | 'median' | 'min' | 'max' | 'stddev' | 'variance' | 'distinct' | 'mode';

export interface ExtendedWidgetConfig extends Omit<WidgetConfig, 'aggregation'> {
    type: 'kpi' | 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'timeline';
    timeGrain?: 'auto' | 'day' | 'week' | 'month' | 'year';
    layout: WidgetLayout;
    chartColor?: string; // Specific color override
    sortBy?: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
    limit?: number;
    zoomLevel?: number; // 0.5 to 5.0
    orientation?: 'vertical' | 'horizontal';
    xAxisLabel?: string;
    yAxisLabel?: string;
    filters?: Record<string, FilterConfig>;
    metricKeys?: string[]; // Array of columns to aggregate (Multi-series support)
    aggregation: AggregationType;
}

export interface SnapLine {
    orientation: 'vertical' | 'horizontal';
    position: number;
    start: number;
    end: number;
    type?: 'gap' | 'align' | 'center';
}

export interface DashboardSpace {
    id: string;
    name: string;
    widgets: ExtendedWidgetConfig[];
}

export interface DashboardConfig {
    version: number;
    spaces: DashboardSpace[];
}

export interface ExtendedColumnAnalysis extends ColumnAnalysis {
    samples: string[];
    topValues?: string[];
}

export type DashboardViewMode = 'data' | 'workbench' | 'canvas';
