/**
 * Base interface for all factory-based managers
 * Provides common pattern for lazy initialization and caching
 */
export interface IBaseFactoryManager<T, K extends string> {
  /**
   * Get cached instance or create new one if needed
   */
  getInstance(key: K): T | null;

  /**
   * Check if instance exists (either cached or available for creation)
   */
  hasInstance(key: K): boolean;

  /**
   * Get all available keys for this manager
   */
  getAllKeys(): K[];
}
