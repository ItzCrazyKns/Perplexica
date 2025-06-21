import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { getModelName } from '../utils/modelUtils';
import { AgentState } from './agentState';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';

export class SynthesizerAgent {
  private llm: BaseChatModel;
  private emitter: EventEmitter;
  private personaInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    emitter: EventEmitter,
    personaInstructions: string,
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.emitter = emitter;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
  }

  /**
   * Synthesizer agent node that combines information to answer the query
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
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

User Query: ${state.originalQuery || state.query}

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
        [
          ...removeThinkingBlocksFromMessages(state.messages),
          new SystemMessage(synthesisPrompt),
          new HumanMessage(state.originalQuery || state.query),
        ],
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
}
