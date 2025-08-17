// Core domain types for widgets
export interface Source {
  url: string;
  type: 'Web Page' | 'HTTP Data';
}

// Grid layout properties for widgets (only position and size data that should be persisted)
export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
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
  tool_names?: string[];
  layout?: WidgetLayout;
}

export interface Widget extends WidgetConfig {
  id: string;
  lastUpdated: Date | null;
  isLoading: boolean;
  content: string | null;
  error: string | null;
  layout: WidgetLayout;
}
