import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { Document } from 'langchain/document';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { webSearchRetrieverAgentPrompt } from '../prompts/webSearch';
import { searchSearxng } from '../searxng';
import { formatDateForLLM } from '../utils';
import { getModelName } from '../utils/modelUtils';
import { summarizeWebContent } from '../utils/summarizeWebContent';

/**
 * State interface for the agent supervisor workflow
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  query: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  relevantDocuments: Annotation<Document[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  bannedUrls: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  searchInstructionHistory: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  searchInstructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
  analysis: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
});

/**
 * Agent Search class implementing LangGraph Supervisor pattern
 */
export class AgentSearch {
  private llm: BaseChatModel;
  private embeddings: Embeddings;
  private checkpointer: MemorySaver;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private personaInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    embeddings: Embeddings,
    emitter: EventEmitter,
    systemInstructions: string = '',
    personaInstructions: string = '',
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.embeddings = embeddings;
    this.checkpointer = new MemorySaver();
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
  }

  /**
   * Web search agent node
   */
  private async webSearchAgent(
    state: typeof AgentState.State,
  ): Promise<Command> {
    const template = PromptTemplate.fromTemplate(webSearchRetrieverAgentPrompt);
    const prompt = await template.format({
      systemInstructions: this.systemInstructions,
      query: state.query,
      date: formatDateForLLM(new Date()),
      supervisor: state.searchInstructions,
    });

    const searchQueryResult = await this.llm.invoke(
      [...state.messages, prompt],
      { signal: this.signal },
    );

    // Parse the response to extract the search query with the lineoutputparser
    const lineOutputParser = new LineOutputParser({ key: 'answer' });
    const searchQuery = await lineOutputParser.parse(
      searchQueryResult.content as string,
    );

    try {
      console.log(`Performing web search for query: "${searchQuery}"`);
      const searchResults = await searchSearxng(searchQuery, {
        language: 'en',
        engines: [],
      });

      let bannedUrls = state.bannedUrls || [];
      let attemptedUrlCount = 0;
      // Summarize the top 2 search results
      let documents: Document[] = [];
      for (const result of searchResults.results) {
        if (bannedUrls.includes(result.url)) {
          console.log(`Skipping banned URL: ${result.url}`);
          continue; // Skip banned URLs
        }
        if (attemptedUrlCount >= 5) {
          console.warn(
            'Too many attempts to summarize URLs, stopping further attempts.',
          );
          break; // Limit the number of attempts to summarize URLs
        }
        attemptedUrlCount++;

        bannedUrls.push(result.url); // Add to banned URLs to avoid duplicates

        if (documents.length >= 1) {
          break; // Limit to top 1 document
        }

        const summary = await summarizeWebContent(
          result.url,
          state.query,
          this.llm,
          this.systemInstructions,
          this.signal,
        );
        if (summary) {
          documents.push(summary);
          console.log(
            `Summarized content from ${result.url} to ${summary.pageContent.length} characters. Content: ${summary.pageContent}`,
          );
        } else {
          console.warn(`No relevant content found for URL: ${result.url}`);
        }
      }

      if (documents.length === 0) {
        return new Command({
          goto: 'analyzer',
          update: {
            messages: [new SystemMessage('No relevant documents found.')],
          },
        });
      }

      const responseMessage = `Web search completed. ${documents.length === 0 && attemptedUrlCount < 5 ? 'This search query does not have enough relevant information. Try rephrasing your query or providing more context.' : `Found ${documents.length} results that are relevant to the query.`}`;
      console.log(responseMessage);

      return new Command({
        goto: 'analyzer',
        update: {
          messages: [new SystemMessage(responseMessage)],
          relevantDocuments: documents,
          bannedUrls: bannedUrls,
        },
      });
    } catch (error) {
      console.error('Web search error:', error);
      const errorMessage = new SystemMessage(
        `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    }
  }

  private async analyzer(state: typeof AgentState.State): Promise<Command> {
    try {
      console.log(
        `Analyzing ${state.relevantDocuments.length} documents for relevance...`,
      );
      const analysisPromptTemplate = `You are an expert content analyzer. Your task is to analyze the provided document and determine if we have enough relevant information to fully answer the user's query. If the content is not sufficient, you will suggest a more specific search query to gather additional information.
# Instructions
- Carefully analyze the content of the context provided and determine if it contains sufficient information to answer the user's query
- The content should completely address the query, providing detailed explanations, relevant facts, and necessary context
- Use the content provided in the \`context\` tag, as well as the historical context of the conversation, to make your determination
- If the context provides conflicting information, explain the discrepancies and what additional information is needed to resolve them
- If the user is asking for a specific number of sources, ensure that we have enough sources to meet that requirement
- Today's date is ${formatDateForLLM(new Date())}

# Output Format
- If the content is sufficient, respond with "good_content" in an <answer> XML tag
- If the content is not sufficient, respond with "need_more_info" in an <answer> XML tag and provide a detailed question that would help gather more specific information to answer the query in a <question> XML tag
  - This question will be used to generate a web search query to gather more information and should be specific, actionable, and focused on the gaps in the current content
  - This step will be repeated until sufficient information is gathered to answer the query. Do not try to answer the entire query at once
  - It should be concise and avoid pleasantries or unnecessary details
  - Break down the query into a smaller, more focused question that can be answered with a web search
  - For example, if the query is asking about specific information from multiple locations, break the query into one smaller query for a single location
  - If if the query is asking about a complex topic, break it down into a single smaller question that can be answered one at a time
  - Avoid asking for general information or vague details; focus on specific, actionable questions that can lead to concrete answers
  - Avoid giving the same guidance more than once, and avoid repeating the same question multiple times
- Respond with your answer in a <answer> XML tag
- If you need more information, provide a detailed question in a <question> XML tag
- If you need more information, provide a detailed one line reason why the content is not sufficient in a <reason> XML tag

# Refinement History
- The following questions have been asked to refine the search
${state.searchInstructionHistory.map((question) => `  - ${question}`).join('\n')}

# System Instructions
- The system instructions provided to you are:
{systemInstructions}

# Example Output
- If the content is sufficient:
<answer>good_content</answer>
- If the content is not sufficient:
<answer>need_more_info</answer>
<question>A question that would help gather more specific information to answer the query?</question>
<reason>A one line reason why the content is not sufficient</reason>

# Context
<context>
{context}
</context>
`;

      const analysisPrompt = await ChatPromptTemplate.fromTemplate(
        analysisPromptTemplate,
      ).format({
        systemInstructions: this.systemInstructions,
        context: state.relevantDocuments
          .map((doc) => doc.pageContent)
          .join('\n\n'),
      });

      const response = await this.llm.invoke(
        [...state.messages, new SystemMessage(analysisPrompt)],
        { signal: this.signal },
      );

      // Parse the response to extract the analysis result
      const analysisOutputParser = new LineOutputParser({ key: 'answer' });
      const moreInfoOutputParser = new LineOutputParser({ key: 'question' });
      const reasonOutputParser = new LineOutputParser({ key: 'reason' });

      const analysisResult = await analysisOutputParser.parse(
        response.content as string,
      );
      const moreInfoQuestion = await moreInfoOutputParser.parse(
        response.content as string,
      );
      const reason = await reasonOutputParser.parse(
        response.content as string,
      );

      console.log('Analysis result:', analysisResult);
      console.log('More info question:', moreInfoQuestion);
      console.log('Reason for insufficiency:', reason);

      if (analysisResult.startsWith('need_more_info')) {
        return new Command({
          goto: 'web_search',
          update: {
            messages: [
              new SystemMessage(
                `The following question can help refine the search: ${moreInfoQuestion}`,
              ),
            ],
            searchInstructions: moreInfoQuestion,
            searchInstructionHistory: [moreInfoQuestion],
          },
        });
      }

      return new Command({
        goto: 'synthesizer',
        update: {
          messages: [
            new SystemMessage(
              `Analysis completed. We have sufficient information to answer the query.`,
            ),
          ],
        },
      });
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = new SystemMessage(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    }
  }

  /**
   * Synthesizer agent node that combines information to answer the query
   */
  private async synthesizerAgent(
    state: typeof AgentState.State,
  ): Promise<Command> {
    try {
      const synthesisPrompt = `You are an expert information synthesizer. Based on the search results and analysis provided, create a comprehensive, well-structured answer to the user's query.

## Response Instructions
Your task is to provide answers that are:
- **Informative and relevant**: Thoroughly address the user's query using the given context
- **Well-structured**: Include clear headings and subheadings, and use a professional tone to present information concisely and logically
- **Engaging and detailed**: Write responses that read like a high-quality blog post, including extra details and relevant insights
- **Cited and credible**: Use inline citations with [number] notation to refer to the context source(s) for each fact or detail included
- **Explanatory and Comprehensive**: Strive to explain the topic in depth, offering detailed analysis, insights, and clarifications wherever applicable

### Formatting Instructions
- **Structure**: Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2"). Present information in paragraphs or concise bullet points where appropriate
- **Tone and Style**: Maintain a neutral, journalistic tone with engaging narrative flow. Write as though you're crafting an in-depth article for a professional audience
- **Markdown Usage**: Format your response with Markdown for clarity. Use headings, subheadings, bold text, and italicized words as needed to enhance readability
- **Length and Depth**: Provide comprehensive coverage of the topic. Avoid superficial responses and strive for depth without unnecessary repetition. Expand on technical or complex topics to make them easier to understand for a general audience
- **No main heading/title**: Start your response directly with the introduction unless asked to provide a specific title
- **Conclusion or Summary**: Include a concluding paragraph that synthesizes the provided information or suggests potential next steps, where appropriate

### Persona Instructions
- Additional user specified persona instructions are provided in the <personaInstructions> tag

### Citation Requirements
- Cite every single fact, statement, or sentence using [number] notation corresponding to the source from the provided \`context\`
- Integrate citations naturally at the end of sentences or clauses as appropriate. For example, "The Eiffel Tower is one of the most visited landmarks in the world[1]."
- Ensure that **every sentence in your response includes at least one citation**, even when information is inferred or connected to general knowledge available in the provided context
- Use multiple sources for a single detail if applicable, such as, "Paris is a cultural hub, attracting millions of visitors annually[1][2]."
- Always prioritize credibility and accuracy by linking all statements back to their respective context sources
- Avoid citing unsupported assumptions or personal interpretations; if no source supports a statement, clearly indicate the limitation

### Example Output
- Begin with a brief introduction summarizing the event or query topic
- Follow with detailed sections under clear headings, covering all aspects of the query if possible
- Provide explanations or historical context as needed to enhance understanding
- End with a conclusion or overall perspective if relevant

<personaInstructions>
${this.personaInstructions}
</personaInstructions>

User Query: ${state.query}

Available Information:
${state.relevantDocuments
  .map(
    (doc, index) =>
      `<${index + 1}>\n
<title>${doc.metadata.title}</title>\n
${doc.metadata?.url.toLowerCase().includes('file') ? '' : '\n<url>' + doc.metadata.url + '</url>\n'}
<content>\n${doc.pageContent}\n</content>\n
</${index + 1}>`,
  )
  .join('\n')}
`;

      // Stream the response in real-time using LLM streaming capabilities
      let fullResponse = '';

      // Emit the sources as a data response
      this.emitter.emit(
        'data',
        JSON.stringify({
          type: 'sources',
          data: state.relevantDocuments,
          searchQuery: '',
          searchUrl: '',
        }),
      );

      const stream = await this.llm.stream(
        [new SystemMessage(synthesisPrompt), new HumanMessage(state.query)],
        { signal: this.signal },
      );

      for await (const chunk of stream) {
        if (this.signal.aborted) {
          break;
        }

        const content = chunk.content;
        if (typeof content === 'string' && content.length > 0) {
          fullResponse += content;

          // Emit each chunk as a data response in real-time
          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: content,
            }),
          );
        }
      }

      // Emit model stats and end signal after streaming is complete
      const modelName = getModelName(this.llm);
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: { modelName },
        }),
      );

      this.emitter.emit('end');

      // Create the final response message with the complete content
      const response = new SystemMessage(fullResponse);

      return new Command({
        goto: END,
        update: {
          messages: [response],
        },
      });
    } catch (error) {
      console.error('Synthesis error:', error);
      const errorMessage = new SystemMessage(
        `Failed to synthesize answer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    }
  }

  /**
   * Create and compile the agent workflow graph
   */
  private createWorkflow() {
    const workflow = new StateGraph(AgentState)
      // .addNode('supervisor', this.supervisor.bind(this), {
      //   ends: ['web_search', 'analyzer', 'synthesizer', END],
      // })
      .addNode('web_search', this.webSearchAgent.bind(this), {
        ends: ['analyzer'],
      })
      .addNode('analyzer', this.analyzer.bind(this), {
        ends: ['web_search', 'synthesizer'],
      })
      // .addNode("url_analyzer", this.urlAnalyzerAgent.bind(this), {
      //   ends: ["supervisor"],
      // })
      .addNode('synthesizer', this.synthesizerAgent.bind(this), {
        ends: [END],
      })
      .addEdge(START, 'analyzer');

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Execute the agent search workflow
   */
  async searchAndAnswer(query: string, history: BaseMessage[] = []) {
    const workflow = this.createWorkflow();

    try {
      const initialState = {
        messages: [...history, new HumanMessage(query)],
        query,
      };

      const result = await workflow.invoke(initialState, {
        configurable: { thread_id: `agent_search_${Date.now()}` },
        recursionLimit: 20,
      });

      return result;
    } catch (error) {
      console.error('Agent workflow error:', error);

      // Fallback to a simple response
      const fallbackResponse = await this.llm.invoke(
        [
          new SystemMessage(
            "You are a helpful assistant. The advanced agent workflow failed, so please provide a basic response to the user's query based on your knowledge.",
          ),
          new HumanMessage(query),
        ],
        { signal: this.signal },
      );

      return {
        messages: [...history, new HumanMessage(query), fallbackResponse],
        query,
        searchResults: [],
        next: END,
        analysis: '',
      };
    }
  }
}
