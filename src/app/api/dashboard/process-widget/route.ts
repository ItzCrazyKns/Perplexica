import { NextRequest, NextResponse } from 'next/server';
import { getWebContent, getWebContentLite } from '@/lib/utils/documents';
import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { getAvailableChatModelProviders } from '@/lib/providers';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { ChatOllama } from '@langchain/ollama';
import axios from 'axios';

interface Source {
  url: string;
  type: 'Web Page' | 'HTTP Data';
}

interface WidgetProcessRequest {
  sources: Source[];
  prompt: string;
  provider: string;
  model: string;
}

// Helper function to fetch content from a single source
async function fetchSourceContent(
  source: Source,
): Promise<{ content: string; error?: string }> {
  try {
    let document;

    if (source.type === 'Web Page') {
      // Use headless browser for complex web pages
      document = await getWebContent(source.url);
    } else {
      // Use faster fetch for HTTP data/APIs
      const response = await axios.get(source.url, { transformResponse: [] });
      document = new Document({
        pageContent: response.data || '',
        metadata: { source: source.url },
      });
    }

    if (!document) {
      return {
        content: '',
        error: `Failed to fetch content from ${source.url}`,
      };
    }

    return { content: document.pageContent };
  } catch (error) {
    console.error(`Error fetching content from ${source.url}:`, error);
    return {
      content: '',
      error: `Error fetching ${source.url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Helper function to replace variables in prompt
function replacePromptVariables(
  prompt: string,
  sourceContents: string[],
  location?: string,
): string {
  let processedPrompt = prompt;

  // Replace source content variables
  sourceContents.forEach((content, index) => {
    const variable = `{{source_content_${index + 1}}}`;
    processedPrompt = processedPrompt.replace(
      new RegExp(variable, 'g'),
      content,
    );
  });

  // Replace location if provided
  if (location) {
    processedPrompt = processedPrompt.replace(/\{\{location\}\}/g, location);
  }

  return processedPrompt;
}

// Helper function to get LLM instance based on provider and model
async function getLLMInstance(
  provider: string,
  model: string,
): Promise<BaseChatModel | null> {
  try {
    const chatModelProviders = await getAvailableChatModelProviders();

    if (provider === 'custom_openai') {
      return new ChatOpenAI({
        modelName: model || getCustomOpenaiModelName(),
        openAIApiKey: getCustomOpenaiApiKey(),
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    }

    if (chatModelProviders[provider] && chatModelProviders[provider][model]) {
      const llm = chatModelProviders[provider][model].model as BaseChatModel;

      // Special handling for Ollama models
      if (llm instanceof ChatOllama && provider === 'ollama') {
        llm.numCtx = 2048; // Default context window
      }

      return llm;
    }

    return null;
  } catch (error) {
    console.error('Error getting LLM instance:', error);
    return null;
  }
}

// Helper function to process the prompt with LLM
async function processWithLLM(
  prompt: string,
  provider: string,
  model: string,
): Promise<string> {
  const llm = await getLLMInstance(provider, model);

  if (!llm) {
    throw new Error(`Invalid or unavailable model: ${provider}/${model}`);
  }

  const message = new HumanMessage({ content: prompt });
  const response = await llm.invoke([message]);

  return response.content as string;
}

export async function POST(request: NextRequest) {
  try {
    const body: WidgetProcessRequest = await request.json();

    // Validate required fields
    if (!body.sources || !body.prompt || !body.provider || !body.model) {
      return NextResponse.json(
        { error: 'Missing required fields: sources, prompt, provider, model' },
        { status: 400 },
      );
    }

    // Validate sources
    if (!Array.isArray(body.sources) || body.sources.length === 0) {
      return NextResponse.json(
        { error: 'At least one source URL is required' },
        { status: 400 },
      );
    }

    // Fetch content from all sources
    console.log(`Processing widget with ${body.sources.length} source(s)`);
    const sourceResults = await Promise.all(
      body.sources.map((source) => fetchSourceContent(source)),
    );

    // Check for fetch errors
    const fetchErrors = sourceResults
      .map((result, index) =>
        result.error ? `Source ${index + 1}: ${result.error}` : null,
      )
      .filter(Boolean);

    if (fetchErrors.length > 0) {
      console.warn('Some sources failed to fetch:', fetchErrors);
    }

    // Extract successful content
    const sourceContents = sourceResults.map((result) => result.content);

    // If all sources failed, return error
    if (sourceContents.every((content) => !content)) {
      return NextResponse.json(
        { error: 'Failed to fetch content from all sources' },
        { status: 500 },
      );
    }

    // Replace variables in prompt
    const processedPrompt = replacePromptVariables(body.prompt, sourceContents);

    console.log('Processing prompt:', processedPrompt);

    // Process with LLM
    try {
      const llmResponse = await processWithLLM(
        processedPrompt,
        body.provider,
        body.model,
      );

      console.log('LLM response:', llmResponse);
      return NextResponse.json({
        content: llmResponse,
        success: true,
        sourcesFetched: sourceContents.filter((content) => content).length,
        totalSources: body.sources.length,
        warnings: fetchErrors.length > 0 ? fetchErrors : undefined,
      });
    } catch (llmError) {
      console.error('LLM processing failed:', llmError);

      // Return diagnostic information if LLM fails
      const diagnosticResponse = `# Widget Processing - LLM Error

**Error:** ${llmError instanceof Error ? llmError.message : 'Unknown LLM error'}

## Processed Prompt (for debugging)
${processedPrompt}

## Sources Successfully Fetched
${sourceContents.filter((content) => content).length} of ${body.sources.length} sources

${fetchErrors.length > 0 ? `## Source Errors\n${fetchErrors.join('\n')}` : ''}`;

      return NextResponse.json({
        content: diagnosticResponse,
        success: false,
        error:
          llmError instanceof Error
            ? llmError.message
            : 'LLM processing failed',
        sourcesFetched: sourceContents.filter((content) => content).length,
        totalSources: body.sources.length,
      });
    }
  } catch (error) {
    console.error('Error processing widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
