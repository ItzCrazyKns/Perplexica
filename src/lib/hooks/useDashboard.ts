import { useState, useEffect, useCallback } from 'react';
import { Layout } from 'react-grid-layout';
import { Widget, WidgetConfig, WidgetLayout } from '@/lib/types/widget';
import {
  DashboardState,
  DashboardConfig,
  DashboardLayouts,
  GridLayoutItem,
  DASHBOARD_STORAGE_KEYS,
} from '@/lib/types/dashboard';
import { WidgetCache } from '@/lib/types/cache';
import { DASHBOARD_CONSTRAINTS, getResponsiveConstraints } from '@/lib/constants/dashboard';

// Helper function to request location permission and get user's location
const requestLocationPermission = async (): Promise<string | undefined> => {
  try {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return undefined;
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        },
        (error) => {
          console.warn('Location access denied or failed:', error.message);
          // Don't reject, just return undefined to continue without location
          resolve(undefined);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds timeout
          maximumAge: 300000, // 5 minutes cache
        },
      );
    });
  } catch (error) {
    console.warn('Error requesting location:', error);
    return undefined;
  }
};

// Helper function to replace date/time variables in prompts on the client side
const replaceDateTimeVariables = (prompt: string): string => {
  let processedPrompt = prompt;

  // Replace UTC datetime
  if (processedPrompt.includes('{{current_utc_datetime}}')) {
    const utcDateTime = new Date().toISOString();
    processedPrompt = processedPrompt.replace(
      /\{\{current_utc_datetime\}\}/g,
      utcDateTime,
    );
  }

  // Replace local datetime
  if (processedPrompt.includes('{{current_local_datetime}}')) {
    const now = new Date();
    const localDateTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    ).toISOString();
    processedPrompt = processedPrompt.replace(
      /\{\{current_local_datetime\}\}/g,
      localDateTime,
    );
  }

  return processedPrompt;
};

interface UseDashboardReturn {
  // State
  widgets: Widget[];
  isLoading: boolean;
  error: string | null;
  settings: DashboardConfig['settings'];

  // Widget management
  addWidget: (config: WidgetConfig) => void;
  updateWidget: (id: string, config: WidgetConfig) => void;
  deleteWidget: (id: string) => void;
  refreshWidget: (id: string, forceRefresh?: boolean) => Promise<void>;
  refreshAllWidgets: (forceRefresh?: boolean) => Promise<void>;

  // Layout management
  updateLayouts: (layouts: DashboardLayouts) => void;
  getLayouts: () => DashboardLayouts;

  // Storage management
  exportDashboard: () => Promise<string>;
  importDashboard: (configJson: string) => Promise<void>;
  clearCache: () => void;

  // Settings
  updateSettings: (newSettings: Partial<DashboardConfig['settings']>) => void;
}

export const useDashboard = (): UseDashboardReturn => {
  const [state, setState] = useState<DashboardState>({
    widgets: [],
    isLoading: true, // Start as loading
    error: null,
    settings: {
      parallelLoading: true,
      autoRefresh: false,
      theme: 'auto',
    },
  });

  const loadDashboardData = useCallback(() => {
    try {
      // Load widgets
      const savedWidgets = localStorage.getItem(DASHBOARD_STORAGE_KEYS.WIDGETS);
      const widgets: Widget[] = savedWidgets ? JSON.parse(savedWidgets) : [];

      // Convert date strings back to Date objects and ensure layout exists
      widgets.forEach((widget, index) => {
        if (widget.lastUpdated) {
          widget.lastUpdated = new Date(widget.lastUpdated);
        }
        
        // Migration: Add default layout if missing
        if (!widget.layout) {
          const defaultLayout: WidgetLayout = {
            x: (index % 2) * 6, // Alternate between columns
            y: Math.floor(index / 2) * 4, // Stack rows
            w: DASHBOARD_CONSTRAINTS.DEFAULT_WIDGET_WIDTH,
            h: DASHBOARD_CONSTRAINTS.DEFAULT_WIDGET_HEIGHT,
            isDraggable: true,
            isResizable: true,
          };
          widget.layout = defaultLayout;
        }
      });

      // Load settings
      const savedSettings = localStorage.getItem(
        DASHBOARD_STORAGE_KEYS.SETTINGS,
      );
      const settings = savedSettings
        ? JSON.parse(savedSettings)
        : {
            parallelLoading: true,
            autoRefresh: false,
            theme: 'auto',
          };

      setState((prev) => ({
        ...prev,
        widgets,
        settings,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load dashboard data',
        isLoading: false,
      }));
    }
  }, []);

  // Load dashboard data from localStorage on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Save widgets to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (!state.isLoading) {
      localStorage.setItem(
        DASHBOARD_STORAGE_KEYS.WIDGETS,
        JSON.stringify(state.widgets),
      );
    }
  }, [state.widgets, state.isLoading]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_STORAGE_KEYS.SETTINGS,
      JSON.stringify(state.settings),
    );
  }, [state.settings]);

  const addWidget = useCallback((config: WidgetConfig) => {
    // Find the next available position in the grid
    const getNextPosition = () => {
      const existingWidgets = state.widgets;
      let x = 0;
      let y = 0;
      
      // Simple algorithm: try to place in first available spot
      for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 12; col += 6) { // Start with half-width widgets
          const position = { x: col, y: row };
          const hasCollision = existingWidgets.some(widget => 
            widget.layout.x < position.x + 6 && 
            widget.layout.x + widget.layout.w > position.x &&
            widget.layout.y < position.y + 3 && 
            widget.layout.y + widget.layout.h > position.y
          );
          
          if (!hasCollision) {
            return { x: position.x, y: position.y };
          }
        }
      }
      
      // Fallback: place at bottom
      const maxY = Math.max(0, ...existingWidgets.map(w => w.layout.y + w.layout.h));
      return { x: 0, y: maxY };
    };

    const position = getNextPosition();
    const defaultLayout: WidgetLayout = {
      x: position.x,
      y: position.y,
      w: DASHBOARD_CONSTRAINTS.DEFAULT_WIDGET_WIDTH,
      h: DASHBOARD_CONSTRAINTS.DEFAULT_WIDGET_HEIGHT,
      isDraggable: true,
      isResizable: true,
    };

    const newWidget: Widget = {
      ...config,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      lastUpdated: null,
      isLoading: false,
      content: null,
      error: null,
      layout: config.layout || defaultLayout,
    };

    setState((prev) => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));
  }, [state.widgets]);

  const updateWidget = useCallback((id: string, config: WidgetConfig) => {
    setState((prev) => ({
      ...prev,
      widgets: prev.widgets.map((widget) =>
        widget.id === id
          ? { 
              ...widget, 
              ...config, 
              id, // Preserve the ID
              layout: config.layout || widget.layout, // Preserve existing layout if not provided
            }
          : widget,
      ),
    }));
  }, []);

  const deleteWidget = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((widget) => widget.id !== id),
    }));

    // Also remove from cache
    const cache = getWidgetCache();
    delete cache[id];
    localStorage.setItem(DASHBOARD_STORAGE_KEYS.CACHE, JSON.stringify(cache));
  }, []);

  const getWidgetCache = (): WidgetCache => {
    try {
      const cached = localStorage.getItem(DASHBOARD_STORAGE_KEYS.CACHE);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  };

  const isWidgetCacheValid = useCallback((widget: Widget): boolean => {
    const cache = getWidgetCache();
    const cachedData = cache[widget.id];

    if (!cachedData) return false;

    const now = new Date();
    const expiresAt = new Date(cachedData.expiresAt);

    return now < expiresAt;
  }, []);

  const getCacheExpiryTime = useCallback((widget: Widget): Date => {
    const now = new Date();
    const refreshMs =
      widget.refreshFrequency *
      (widget.refreshUnit === 'hours' ? 3600000 : 60000);
    return new Date(now.getTime() + refreshMs);
  }, []);

  const refreshWidget = useCallback(
    async (id: string, forceRefresh: boolean = false) => {
      const widget = state.widgets.find((w) => w.id === id);
      if (!widget) return;

      // Check cache first (unless forcing refresh)
      if (!forceRefresh && isWidgetCacheValid(widget)) {
        const cache = getWidgetCache();
        const cachedData = cache[widget.id];
        setState((prev) => ({
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === id
              ? {
                  ...w,
                  content: cachedData.content,
                  lastUpdated: new Date(cachedData.lastFetched),
                }
              : w,
          ),
        }));
        return;
      }

      // Set loading state
      setState((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === id ? { ...w, isLoading: true, error: null } : w,
        ),
      }));

      try {
        // Check if prompt uses location variable and request permission if needed
        let location: string | undefined;
        if (widget.prompt.includes('{{location}}')) {
          location = await requestLocationPermission();
        }

        // Replace date/time variables on the client side
        const processedPrompt = replaceDateTimeVariables(widget.prompt);

        const response = await fetch('/api/dashboard/process-widget', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sources: widget.sources,
            prompt: processedPrompt,
            provider: widget.provider,
            model: widget.model,
            tool_names: widget.tool_names,
            location,
          }),
        });

        const result = await response.json();
        const now = new Date();

        if (result.success) {
          // Update widget
          setState((prev) => ({
            ...prev,
            widgets: prev.widgets.map((w) =>
              w.id === id
                ? {
                    ...w,
                    isLoading: false,
                    content: result.content,
                    lastUpdated: now,
                    error: null,
                  }
                : w,
            ),
          }));

          // Cache the result
          const cache = getWidgetCache();
          cache[id] = {
            content: result.content,
            lastFetched: now,
            expiresAt: getCacheExpiryTime(widget),
          };
          localStorage.setItem(
            DASHBOARD_STORAGE_KEYS.CACHE,
            JSON.stringify(cache),
          );
        } else {
          setState((prev) => ({
            ...prev,
            widgets: prev.widgets.map((w) =>
              w.id === id
                ? {
                    ...w,
                    isLoading: false,
                    error: result.error || 'Failed to refresh widget',
                  }
                : w,
            ),
          }));
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === id
              ? {
                  ...w,
                  isLoading: false,
                  error: 'Network error: Failed to refresh widget',
                }
              : w,
          ),
        }));
      }
    },
    [state.widgets, isWidgetCacheValid, getCacheExpiryTime],
  );

  const refreshAllWidgets = useCallback(
    async (forceRefresh = false) => {
      const activeWidgets = state.widgets.filter((w) => !w.isLoading);

      if (state.settings.parallelLoading) {
        // Refresh all widgets in parallel (force refresh)
        await Promise.all(
          activeWidgets.map((widget) => refreshWidget(widget.id, forceRefresh)),
        );
      } else {
        // Refresh widgets sequentially (force refresh)
        for (const widget of activeWidgets) {
          await refreshWidget(widget.id, forceRefresh);
        }
      }
    },
    [state.widgets, state.settings.parallelLoading, refreshWidget],
  );

  const exportDashboard = useCallback(async (): Promise<string> => {
    const dashboardConfig: DashboardConfig = {
      widgets: state.widgets,
      settings: state.settings,
      lastExport: new Date(),
      version: '1.0.0',
    };

    return JSON.stringify(dashboardConfig, null, 2);
  }, [state.widgets, state.settings]);

  const importDashboard = useCallback(
    async (configJson: string): Promise<void> => {
      try {
        const config: DashboardConfig = JSON.parse(configJson);

        // Validate the config structure
        if (!config.widgets || !Array.isArray(config.widgets)) {
          throw new Error(
            'Invalid dashboard configuration: missing or invalid widgets array',
          );
        }

        // Process widgets and ensure they have valid IDs
        const processedWidgets: Widget[] = config.widgets.map((widget) => ({
          ...widget,
          id:
            widget.id ||
            Date.now().toString() + Math.random().toString(36).substr(2, 9),
          lastUpdated: widget.lastUpdated ? new Date(widget.lastUpdated) : null,
          isLoading: false,
          content: widget.content || null,
          error: null,
        }));

        setState((prev) => ({
          ...prev,
          widgets: processedWidgets,
          settings: { ...prev.settings, ...config.settings },
        }));
      } catch (error) {
        throw new Error(
          `Failed to import dashboard: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        );
      }
    },
    [],
  );

  const clearCache = useCallback(() => {
    localStorage.removeItem(DASHBOARD_STORAGE_KEYS.CACHE);
  }, []);

  const updateSettings = useCallback(
    (newSettings: Partial<DashboardConfig['settings']>) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...newSettings },
      }));
    },
    [],
  );

  const getLayouts = useCallback((): DashboardLayouts => {
    const createBreakpointLayout = (breakpoint: keyof typeof DASHBOARD_CONSTRAINTS.GRID_COLUMNS) => {
      const constraints = getResponsiveConstraints(breakpoint);
      const maxCols = DASHBOARD_CONSTRAINTS.GRID_COLUMNS[breakpoint];
      
      return state.widgets.map(widget => ({
        i: widget.id,
        x: widget.layout.x,
        y: widget.layout.y,
        w: Math.min(widget.layout.w, maxCols), // Constrain width to available columns
        h: widget.layout.h,
        minW: constraints.minW,
        maxW: constraints.maxW,
        minH: constraints.minH,
        maxH: constraints.maxH,
        static: widget.layout.static,
        isDraggable: widget.layout.isDraggable,
        isResizable: widget.layout.isResizable,
      }));
    };

    return {
      lg: createBreakpointLayout('lg'),
      md: createBreakpointLayout('md'),
      sm: createBreakpointLayout('sm'),
      xs: createBreakpointLayout('xs'),
      xxs: createBreakpointLayout('xxs'),
    };
  }, [state.widgets]);

  const updateLayouts = useCallback((layouts: DashboardLayouts) => {
    const updatedWidgets = state.widgets.map(widget => {
      // Use lg layout as the primary layout for position and size updates
      const newLayout = layouts.lg.find((layout: Layout) => layout.i === widget.id);
      if (newLayout) {
        return {
          ...widget,
          layout: {
            x: newLayout.x,
            y: newLayout.y,
            w: newLayout.w,
            h: newLayout.h,
            static: newLayout.static || widget.layout.static,
            isDraggable: newLayout.isDraggable ?? widget.layout.isDraggable,
            isResizable: newLayout.isResizable ?? widget.layout.isResizable,
          },
        };
      }
      return widget;
    });

    setState(prev => ({
      ...prev,
      widgets: updatedWidgets,
    }));
  }, [state.widgets]);

  return {
    // State
    widgets: state.widgets,
    isLoading: state.isLoading,
    error: state.error,
    settings: state.settings,

    // Widget management
    addWidget,
    updateWidget,
    deleteWidget,
    refreshWidget,
    refreshAllWidgets,

    // Layout management
    updateLayouts,
    getLayouts,

    // Storage management
    exportDashboard,
    importDashboard,
    clearCache,

    // Settings
    updateSettings,
  };
};
