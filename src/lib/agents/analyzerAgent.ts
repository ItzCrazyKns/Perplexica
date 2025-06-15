import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { formatDateForLLM } from '../utils';
import { AgentState } from './agentState';

export class AnalyzerAgent {
  private llm: BaseChatModel;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    emitter: EventEmitter,
    systemInstructions: string,
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.signal = signal;
  }

  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      // Emit initial analysis event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'ANALYZING_CONTEXT',
          message: 'Analyzing the context to see if we have enough information to answer the query',
          details: {
            documentCount: state.relevantDocuments.length,
            query: state.query,
            searchIterations: state.searchInstructionHistory.length
          }
        }
      });

      console.log(
        `Analyzing ${state.relevantDocuments.length} documents for relevance...`,
      );
      const analysisPromptTemplate = `You are an expert content analyzer. Your task is to analyze the provided document and determine if we have enough relevant information to fully answer the user's query. If the content is not sufficient, you will suggest a more specific search query to gather additional information.
# Instructions
- Carefully analyze the content of the context provided and determine if it contains sufficient information to answer the user's query
- The content should completely address the query, providing detailed explanations, relevant facts, and necessary context
- Use the content provided in the \`context\` tag, as well as the historical context of the conversation, to make your determination
- If the context provides conflicting information, explain the discrepancies and what additional information is needed to resolve them
- If the user is asking for a specific number of sources and the context does not provide enough, consider the content insufficient

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
Today's date is ${formatDateForLLM(new Date())}
{context}
</context>`;

      const analysisPrompt = await ChatPromptTemplate.fromTemplate(
        analysisPromptTemplate,
      ).format({
        systemInstructions: this.systemInstructions,
        context: state.relevantDocuments
          .map((doc, index) => `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`)
          .join('\n\n'),
      });

      const response = await this.llm.invoke(
        [...state.messages, new AIMessage(analysisPrompt)],
        { signal: this.signal },
      );

      console.log('Analysis response:', response.content);
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

      if (!analysisResult.startsWith('good_content')) {
        // Emit reanalyzing event when we need more information
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'MORE_DATA_NEEDED',
            message: 'Current context is insufficient - gathering more information',
            details: {
              reason: reason,
              nextSearchQuery: moreInfoQuestion,
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length,
              query: state.query
            }
          }
        });

        return new Command({
          goto: 'web_search',
          update: {
            messages: [
              new AIMessage(
                `The following question can help refine the search: ${moreInfoQuestion}`,
              ),
            ],
            searchInstructions: moreInfoQuestion,
            searchInstructionHistory: [moreInfoQuestion],
          },
        });
      }

      // Emit information gathering complete event when we have sufficient information
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'INFORMATION_GATHERING_COMPLETE',
          message: 'Sufficient information gathered - ready to synthesize response',
          details: {
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length,
            query: state.query
          }
        }
      });

      return new Command({
        goto: 'synthesizer',
        update: {
          messages: [
            new AIMessage(
              `Analysis completed. We have sufficient information to answer the query.`,
            ),
          ],
        },
      });
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = new AIMessage(
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
}
