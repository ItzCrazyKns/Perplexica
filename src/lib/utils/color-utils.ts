/**
 * Color utility functions for theme calculations and accessibility
 * Based on WCAG 2.1 contrast ratio guidelines
 */

/**
 * Converts hex color to RGB values
 * @param hex - Hex color string (e.g., '#ff0000' or '#f00')
 * @returns RGB object with r, g, b values (0-255)
 */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  // Remove the hash if present
  hex = hex.replace('#', '');

  // Convert 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (hex.length !== 6) {
    return null;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Converts RGB values to hex color
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Converts sRGB color component to linear RGB
 * @param colorComponent - Color component (0-255)
 * @returns Linear RGB component (0-1)
 */
function sRGBToLinear(colorComponent: number): number {
  const c = colorComponent / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculates the relative luminance of a color according to WCAG 2.1
 * @param hex - Hex color string
 * @returns Relative luminance (0-1)
 */
export function calculateLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const { r, g, b } = rgb;

  // Convert to linear RGB
  const linearR = sRGBToLinear(r);
  const linearG = sRGBToLinear(g);
  const linearB = sRGBToLinear(b);

  // Calculate relative luminance using WCAG formula
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

/**
 * Calculates the contrast ratio between two colors according to WCAG 2.1
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const luminance1 = calculateLuminance(color1);
  const luminance2 = calculateLuminance(color2);

  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determines if a color is considered "light" (high luminance)
 * @param hex - Hex color string
 * @returns true if color is light
 */
export function isLightColor(hex: string): boolean {
  return calculateLuminance(hex) > 0.5;
}

/**
 * Gets appropriate text color (black or white) for maximum contrast
 * @param backgroundHex - Background hex color
 * @returns '#000000' for light backgrounds, '#ffffff' for dark backgrounds
 */
export function getContrastingTextColor(backgroundHex: string): string {
  return isLightColor(backgroundHex) ? '#000000' : '#ffffff';
}

/**
 * Checks if color combination meets WCAG contrast requirements
 * @param foregroundHex - Foreground color hex
 * @param backgroundHex - Background color hex
 * @param level - WCAG level ('AA' | 'AAA')
 * @param size - Text size ('normal' | 'large')
 * @returns true if contrast ratio is sufficient
 */
export function meetsContrastRequirement(
  foregroundHex: string,
  backgroundHex: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal',
): boolean {
  const contrastRatio = calculateContrastRatio(foregroundHex, backgroundHex);

  // WCAG 2.1 contrast requirements
  const requirements = {
    AA: { normal: 4.5, large: 3.0 },
    AAA: { normal: 7.0, large: 4.5 },
  };

  return contrastRatio >= requirements[level][size];
}

/**
 * Adjusts color brightness by a percentage
 * @param hex - Hex color string
 * @param percent - Brightness adjustment percentage (-100 to 100)
 * @returns Adjusted hex color
 */
export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const adjust = (color: number): number => {
    const adjusted = color + (percent / 100) * 255;
    return Math.max(0, Math.min(255, Math.round(adjusted)));
  };

  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

/**
 * Creates a hover variant of a color (slightly darker/lighter)
 * @param hex - Base hex color
 * @param amount - Adjustment amount (default: 10% darker for light colors, 15% lighter for dark)
 * @returns Hover variant hex color
 */
export function createHoverVariant(hex: string, amount?: number): string {
  const defaultAmount = isLightColor(hex) ? -10 : 15;
  return adjustBrightness(hex, amount ?? defaultAmount);
}

/**
 * Creates a secondary variant of a color (more subtle)
 * @param hex - Base hex color
 * @param opacity - Opacity factor (0-1, default: 0.1)
 * @returns Secondary variant hex color (mixed with appropriate base)
 */
export function createSecondaryVariant(
  hex: string,
  opacity: number = 0.1,
): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  // For light colors, mix with black to make slightly darker
  // For dark colors, mix with white to make slightly lighter
  const base = isLightColor(hex) ? 0 : 255;
  const mix = (color: number): number => {
    return Math.round(color * (1 - opacity) + base * opacity);
  };

  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

/**
 * Validates and normalizes hex color format
 * @param hex - Input hex color (with or without #)
 * @returns Normalized hex color string or null if invalid
 */
export function normalizeHexColor(hex: string): string | null {
  // Remove any whitespace
  hex = hex.trim();

  // Add # if missing
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }

  // Convert 3-digit to 6-digit
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }

  // Validate final format
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  return hex.toLowerCase();
}
