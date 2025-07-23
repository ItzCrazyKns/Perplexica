// API request/response types
import { Source } from './widget';

export interface WidgetProcessRequest {
  sources: Source[];
  prompt: string;
  provider: string;
  model: string;
  tool_names?: string[];
}

export interface WidgetProcessResponse {
  content: string;
  success: boolean;
  sourcesFetched?: number;
  totalSources?: number;
  warnings?: string[];
  error?: string;
}
