// Dashboard configuration and state types
import { Widget } from './widget';

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

// Local storage keys
export const DASHBOARD_STORAGE_KEYS = {
  WIDGETS: 'perplexica_dashboard_widgets',
  SETTINGS: 'perplexica_dashboard_settings',
  CACHE: 'perplexica_dashboard_cache',
} as const;
