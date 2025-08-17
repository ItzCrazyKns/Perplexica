// Cache-related types
export interface WidgetCache {
  [widgetId: string]: {
    content: string;
    lastFetched: Date;
    expiresAt: Date;
  };
}
