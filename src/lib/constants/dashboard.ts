// Dashboard-wide constants and constraints
export const DASHBOARD_CONSTRAINTS = {
  // Grid layout constraints
  WIDGET_MIN_WIDTH: 2,  // Minimum columns
  WIDGET_MAX_WIDTH: 12, // Maximum columns (full width)
  WIDGET_MIN_HEIGHT: 2, // Minimum rows
  WIDGET_MAX_HEIGHT: 20, // Maximum rows
  
  // Default widget sizing
  DEFAULT_WIDGET_WIDTH: 6,  // Half width by default
  DEFAULT_WIDGET_HEIGHT: 4, // Standard height
  
  // Grid configuration
  GRID_COLUMNS: {
    lg: 12,
    md: 10,
    sm: 6,
    xs: 4,
    xxs: 2,
  },
  
  GRID_BREAKPOINTS: {
    lg: 1200,
    md: 996,
    sm: 768,
    xs: 480,
    xxs: 0,
  },
  
  GRID_ROW_HEIGHT: 60,
  GRID_MARGIN: [16, 16] as [number, number],
  GRID_CONTAINER_PADDING: [0, 0] as [number, number],
} as const;

// Responsive constraints - adjust max width based on breakpoint
export const getResponsiveConstraints = (breakpoint: keyof typeof DASHBOARD_CONSTRAINTS.GRID_COLUMNS) => {
  const maxCols = DASHBOARD_CONSTRAINTS.GRID_COLUMNS[breakpoint];
  return {
    minW: DASHBOARD_CONSTRAINTS.WIDGET_MIN_WIDTH,
    maxW: Math.min(DASHBOARD_CONSTRAINTS.WIDGET_MAX_WIDTH, maxCols),
    minH: DASHBOARD_CONSTRAINTS.WIDGET_MIN_HEIGHT,
    maxH: DASHBOARD_CONSTRAINTS.WIDGET_MAX_HEIGHT,
  };
};
