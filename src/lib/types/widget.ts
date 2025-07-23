// Core domain types for widgets
export interface Source {
  url: string;
  type: 'Web Page' | 'HTTP Data';
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
}

export interface Widget extends WidgetConfig {
  id: string;
  lastUpdated: Date | null;
  isLoading: boolean;
  content: string | null;
  error: string | null;
}
