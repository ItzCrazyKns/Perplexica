/**
 * Agent Tools for Simplified Chat Agent
 *
 * This module exports all the tools that reimplement the functionality of the
 * existing LangGraph agents for use with createReactAgent. Each tool encapsulates
 * the core logic of its corresponding agent and follows the Command pattern for
 * state management.
 */

// Import all agent tools (will be uncommented as tools are implemented)
import { taskManagerTool } from './taskManagerTool';
import { simpleWebSearchTool } from './simpleWebSearchTool';
import { fileSearchTool } from './fileSearchTool';
import { imageSearchTool } from './imageSearchTool';
import { urlSummarizationTool } from './urlSummarizationTool';

// Export individual tools (will be uncommented as tools are implemented)
export { taskManagerTool };
export { simpleWebSearchTool };
export { fileSearchTool };
export { imageSearchTool };

// Array containing all available agent tools for the simplified chat agent
// This will be used by the createReactAgent implementation
export const allAgentTools = [
  //taskManagerTool,
  //webSearchTool,
  simpleWebSearchTool,
  fileSearchTool,
  urlSummarizationTool,
  imageSearchTool,
];

// Export tool categories for selective tool loading based on focus mode
export const webSearchTools = [
  //webSearchTool,
  simpleWebSearchTool,
  urlSummarizationTool,
  imageSearchTool,
  // analyzerTool,
  // synthesizerTool,
];

export const fileSearchTools = [
  fileSearchTool,
  // analyzerTool,
  // synthesizerTool,
];

// Core tools that are always available
export const coreTools = [
  //taskManagerTool
];
