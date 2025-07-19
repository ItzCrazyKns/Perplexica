// Dashboard-related TypeScript type definitions

export interface Source {
  url: string;
  type: 'Web Page' | 'HTTP Data';
}

export interface Widget {
  id: string;
  title: string;
  sources: Source[];
  prompt: string;
  provider: string;
  model: string;
  refreshFrequency: number;
  refreshUnit: 'minutes' | 'hours';
  lastUpdated: Date | null;
  isLoading: boolean;
  content: string | null;
  error: string | null;
}

export interface WidgetConfig {
  id?: string;
  title: string;
  sources: Source[];
  prompt: string;
  provider: string;
  model: string;
  refreshFrequency: number;
  refreshUnit: 'minutes' | 'hours';
}

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

// Widget processing API types
export interface WidgetProcessRequest {
  sources: Source[];
  prompt: string;
  provider: string;
  model: string;
}

export interface WidgetProcessResponse {
  content: string;
  success: boolean;
  sourcesFetched?: number;
  totalSources?: number;
  warnings?: string[];
  error?: string;
}

// Local storage keys
export const DASHBOARD_STORAGE_KEYS = {
  WIDGETS: 'perplexica_dashboard_widgets',
  SETTINGS: 'perplexica_dashboard_settings',
  CACHE: 'perplexica_dashboard_cache',
} as const;

// Cache types
export interface WidgetCache {
  [widgetId: string]: {
    content: string;
    lastFetched: Date;
    expiresAt: Date;
  };
}
