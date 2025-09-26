import MemoryService from './memoryService';

// Singleton instance
const memoryService = MemoryService.getInstance();

export default memoryService;
export { MemoryService };
export * from './types';
export * from './utils';