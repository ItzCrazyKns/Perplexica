// Dashboard configuration and state types
import { Widget, WidgetLayout } from './widget';
import { Layout } from 'react-grid-layout';

export interface DashboardConfig {
  widgets: Widget[];
  settings: {
    parallelLoading: boolean;
    autoRefresh: boolean;
    theme: 'auto' | 'light' | 'dark';
  };
  lastExport?: Date;
  version: string;
}

export interface DashboardState {
  widgets: Widget[];
  isLoading: boolean;
  error: string | null;
  settings: DashboardConfig['settings'];
}

// Layout item for react-grid-layout (extends WidgetLayout with required 'i' property)
export interface GridLayoutItem extends WidgetLayout {
  i: string; // Widget ID
}

// Layout configuration for responsive grid (compatible with react-grid-layout)
export interface DashboardLayouts {
  lg: Layout[];
  md: Layout[];
  sm: Layout[];
  xs: Layout[];
  xxs: Layout[];
  [key: string]: Layout[]; // Index signature for react-grid-layout compatibility
}

// Local storage keys
export const DASHBOARD_STORAGE_KEYS = {
  WIDGETS: 'perplexica_dashboard_widgets',
  SETTINGS: 'perplexica_dashboard_settings',
  CACHE: 'perplexica_dashboard_cache',
  LAYOUTS: 'perplexica_dashboard_layouts',
} as const;
