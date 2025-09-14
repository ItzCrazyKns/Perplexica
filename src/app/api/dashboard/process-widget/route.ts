import { NextRequest, NextResponse } from 'next/server';
import { getWebContent } from '@/lib/utils/documents';
import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getAvailableChatModelProviders } from '@/lib/providers';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { ChatOllama } from '@langchain/ollama';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { allTools } from '@/lib/tools';
import { Source } from '@/lib/types/widget';
import { WidgetProcessRequest } from '@/lib/types/api';
import axios from 'axios';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

// Helper function to fetch content from a single source
async function fetchSourceContent(
  source: Source,
): Promise<{ content: string; error?: string }> {
  try {
    let document;

    if (source.type === 'Web Page') {
      // Use headless browser for complex web pages
      document = await getWebContent(source.url, 50000);
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
        apiKey: getCustomOpenaiApiKey(),
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

// Helper function to process the prompt with LLM using agentic workflow
async function processWithLLM(
  prompt: string,
  provider: string,
  model: string,
  tool_names?: string[],
): Promise<string> {
  const llm = await getLLMInstance(provider, model);

  if (!llm) {
    throw new Error(`Invalid or unavailable model: ${provider}/${model}`);
  }

  // Filter tools based on tool_names parameter
  const tools =
    tool_names && tool_names.length > 0
      ? allTools.filter((tool) => tool_names.includes(tool.name))
      : [];

  // Create the React agent with tools
  const agent = createReactAgent({
    llm,
    tools,
  });

  // Invoke the agent with the prompt
  const response = await agent.invoke(
    {
      messages: [
        //new SystemMessage({ content: `You have the following tools available: ${tools.map(tool => tool.name).join(', ')} use them as necessary to complete the task.` }),
        new HumanMessage({ content: prompt }),
      ],
    },
    {
      recursionLimit: 15, // Limit recursion depth to prevent infinite loops
      ...getLangfuseCallbacks(),
    },
  );

  // Extract the final response content
  const lastMessage = response.messages[response.messages.length - 1];
  return lastMessage.content as string;
}

export async function POST(request: NextRequest) {
  try {
    const body: WidgetProcessRequest = await request.json();

    // Validate required fields
    if (!body.prompt || !body.provider || !body.model) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, provider, model' },
        { status: 400 },
      );
    }

    const sources = body.sources;
    let sourceContents: string[] = [];
    let fetchErrors: string[] = [];
    let processedPrompt = body.prompt;
    let sourcesFetched = 0;
    let totalSources = sources ? sources.length : 0;

    if (sources && sources.length > 0) {
      // Fetch content from all sources
      console.log(`Processing widget with ${sources.length} source(s)`);
      const sourceResults = await Promise.all(
        sources.map((source) => fetchSourceContent(source)),
      );
      // Check for fetch errors
      fetchErrors = sourceResults
        .map((result, index) =>
          result.error ? `Source ${index + 1}: ${result.error}` : null,
        )
        .filter((msg): msg is string => Boolean(msg));
      if (fetchErrors.length > 0) {
        console.warn('Some sources failed to fetch:', fetchErrors);
      }
      // Extract successful content
      sourceContents = sourceResults.map((result) => result.content);
      sourcesFetched = sourceContents.filter((content) => content).length;
      // If all sources failed, return error
      if (
        sourceContents.length > 0 &&
        sourceContents.every((content) => !content)
      ) {
        return NextResponse.json(
          { error: 'Failed to fetch content from all sources' },
          { status: 500 },
        );
      }
      // Replace variables in prompt
      processedPrompt = replacePromptVariables(body.prompt, sourceContents);
    }

    console.log('Processing prompt:', processedPrompt);

    // Process with LLM
    try {
      const llmResponse = await processWithLLM(
        processedPrompt,
        body.provider,
        body.model,
        body.tool_names,
      );

      console.log('LLM response:', llmResponse);
      return NextResponse.json({
        content: llmResponse,
        success: true,
        sourcesFetched,
        totalSources,
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
${sourcesFetched} of ${totalSources} sources

${fetchErrors.length > 0 ? `## Source Errors\n${fetchErrors.join('\n')}` : ''}`;

      return NextResponse.json({
        content: diagnosticResponse,
        success: false,
        error:
          llmError instanceof Error
            ? llmError.message
            : 'LLM processing failed',
        sourcesFetched,
        totalSources,
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
