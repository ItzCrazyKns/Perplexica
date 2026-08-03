import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { TextBlock } from '@/lib/types';
import { sanitizeUntrusted } from '@/lib/utils/sanitizeUntrusted';
import { createToolCallXmlFilter } from '@/lib/utils/stripToolCallXml';
import { withInactivityTimeout } from '@/lib/utils/streamTimeout';
import { detectSummaryIntent } from './summarize';
import { ActionRegistry } from './researcher/actions';
import { createResearchBudget } from './researchBudget';
import { seedAllowedUrls } from './urlAllowlist';

class SearchAgent {
  /*
   * Callers start this without awaiting, so nothing here may reject:
   * an unhandled rejection takes the process down and leaves the
   * client waiting on a stream that is never closed.
   */
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      await this.run(session, input);
    } catch (err: any) {
      console.error('Search agent failed:', err);

      if (input.persist !== false) {
        await db
          .update(messages)
          .set({ status: 'error' })
          .where(
            and(
              eq(messages.chatId, input.chatId),
              eq(messages.messageId, input.messageId),
            ),
          )
          .execute()
          .catch((dbErr) =>
            console.error('Failed to mark message as errored:', dbErr),
          );
      }

      session.emit('error', {
        data: err?.message ?? 'An error occurred while answering.',
      });
    }
  }

  /* Insert or reset the row for this turn; on a rewrite, drop every
     later row so history stays a prefix. */
  private async prepareMessageRow(
    session: SessionManager,
    input: SearchAgentInput,
  ) {
    const exists = await db.query.messages.findFirst({
      where: and(
        eq(messages.chatId, input.chatId),
        eq(messages.messageId, input.messageId),
      ),
    });

    if (!exists) {
      await db.insert(messages).values({
        chatId: input.chatId,
        messageId: input.messageId,
        backendId: session.id,
        query: input.followUp,
        createdAt: new Date().toISOString(),
        status: 'answering',
        responseBlocks: [],
      });
    } else {
      await db
        .delete(messages)
        .where(
          and(eq(messages.chatId, input.chatId), gt(messages.id, exists.id)),
        )
        .execute();
      await db
        .update(messages)
        .set({
          status: 'answering',
          backendId: session.id,
          responseBlocks: [],
        })
        .where(
          and(
            eq(messages.chatId, input.chatId),
            eq(messages.messageId, input.messageId),
          ),
        )
        .execute();
    }
  }

  /* Scrape the pasted article(s) and return writer context, or null
     if nothing could be fetched (caller falls back to full research).
     Emits the research/source blocks the UI expects. */
  private async summarizeContext(
    session: SessionManager,
    input: SearchAgentInput,
    urls: string[],
  ): Promise<string | null> {
    const researchBlockId = crypto.randomUUID();
    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: { subSteps: [] },
    });

    const results = await ActionRegistry.executeAll(
      [{ id: 'summary-scrape-0', name: 'scrape_url', arguments: { urls } }],
      {
        llm: input.config.llm,
        embedding: input.config.embedding,
        session: session,
        researchBlockId: researchBlockId,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        budget: createResearchBudget(input.config.mode),
        allowedScrapeUrls: seedAllowedUrls(input.chatHistory, input.followUp),
      },
    );

    const output = results[0];
    const findings =
      output?.type === 'search_results'
        ? output.results.filter(
            (f) =>
              f.content &&
              !/^(Error scraping|Blocked scrape)/.test(f.metadata?.title ?? '') &&
              !/^(Failed to fetch|Skipped |Scraping )/.test(f.content),
          )
        : [];

    const totalContent = findings.reduce(
      (n, f) => n + (f.content?.length ?? 0),
      0,
    );

    /* Bot walls and cookie pages scrape 'successfully' with a few
       hundred chars of chrome; summarizing that helps nobody, so let
       full research look the topic up instead. */
    if (findings.length === 0 || totalContent < 500) return null;

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: findings,
    });

    session.emit('data', { type: 'researchComplete' });

    const articles = findings
      .map(
        (f, index) =>
          `<result index=${index + 1} title=${JSON.stringify(f.metadata?.title ?? '')}>${sanitizeUntrusted(f.content)}</result>`,
      )
      .join('\n');

    return `<search_results note="The user asked for a summary of the linked page(s); this is their full extracted content. Summarize it faithfully and cite it.">\n${articles}\n</search_results>`;
  }

  private async run(session: SessionManager, input: SearchAgentInput) {
    if (input.persist !== false) {
      await this.prepareMessageRow(session, input);
    }

    /* A summary request for a link is a focused task: no classifier,
       no widgets, no search fan-out that buries the article under
       loosely related results. Full research is the fallback when the
       page cannot be fetched. */
    const summaryUrls = detectSummaryIntent(input.followUp);
    const summaryContext = summaryUrls
      ? await this.summarizeContext(session, input, summaryUrls)
      : null;

    if (summaryContext) {
      await this.writeAnswer(session, input, summaryContext);
      return;
    }

    const classification = await classify({
      chatHistory: input.chatHistory,
      enabledSources: input.config.sources,
      query: input.followUp,
      llm: input.config.llm,
    });

    const widgetPromise = WidgetExecutor.executeAll({
      classification,
      chatHistory: input.chatHistory,
      followUp: input.followUp,
      llm: input.config.llm,
    }).then((widgetOutputs) => {
      widgetOutputs.forEach((o) => {
        session.emitBlock({
          id: crypto.randomUUID(),
          type: 'widget',
          data: {
            widgetType: o.type,
            params: o.data,
          },
        });
      });
      return widgetOutputs;
    });

    let searchPromise: Promise<ResearcherOutput> | null = null;

    if (!classification.classification.skipSearch) {
      const researcher = new Researcher();
      searchPromise = researcher.research(session, {
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        classification: classification,
        config: input.config,
      });
    }

    const [widgetOutputs, searchResults] = await Promise.all([
      widgetPromise,
      searchPromise,
    ]);

    session.emit('data', {
      type: 'researchComplete',
    });

    let finalContext =
      '<Query to be answered without searching; Search not made>';

    if (searchResults) {
      finalContext = searchResults?.searchFindings
        .map(
          (f, index) =>
            `<result index=${index + 1} title=${JSON.stringify(f.metadata.title ?? '')}>${sanitizeUntrusted(f.content)}</result>`,
        )
        .join('\n');
    }

    const widgetContext = widgetOutputs
      .map((o) => {
        return `<result>${o.llmContext}</result>`;
      })
      .join('\n-------------\n');

    const finalContextWithWidgets = `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;

    await this.writeAnswer(session, input, finalContextWithWidgets);
  }

  private async writeAnswer(
    session: SessionManager,
    input: SearchAgentInput,
    context: string,
  ) {
    const writerPrompt = getWriterPrompt(
      context,
      input.config.systemInstructions,
      input.config.mode,
    );

    const answerStream = input.config.llm.streamText({
      messages: [
        {
          role: 'system',
          content: writerPrompt,
        },
        ...input.chatHistory,
        {
          role: 'user',
          content: input.followUp,
        },
      ],
    });

    let responseBlockId = '';

    const emitAnswerText = (text: string) => {
      if (!text) return;

      if (!responseBlockId) {
        const block: TextBlock = {
          id: crypto.randomUUID(),
          type: 'text',
          data: text,
        };

        session.emitBlock(block);

        responseBlockId = block.id;
      } else {
        session.appendText(responseBlockId, text);
      }
    };

    /* An all-tool-XML answer (filtered to nothing) is sampling
       variance on local models; one extra roll converts most of them.
       Only after the retry does it fail into the retry banner. */
    for (let attempt = 0; attempt < 2 && !responseBlockId; attempt++) {
      const stream =
        attempt === 0
          ? answerStream
          : input.config.llm.streamText({
              messages: [
                { role: 'system', content: writerPrompt },
                ...input.chatHistory,
                { role: 'user', content: input.followUp },
              ],
            });

      let rawLength = 0;
      const xmlFilter = createToolCallXmlFilter();

      for await (const chunk of withInactivityTimeout(
        stream,
        120_000,
        'Answer stream',
      )) {
        rawLength += (chunk.contentChunk || '').length;
        emitAnswerText(xmlFilter.write(chunk.contentChunk || ''));
      }

      emitAnswerText(xmlFilter.flush());

      if (!responseBlockId) {
        console.warn(
          `Writer attempt ${attempt + 1} produced no visible answer (raw stream length ${rawLength})`,
        );
      }
    }

    if (!responseBlockId) {
      throw new Error('The model returned an empty answer. Please retry.');
    }

    session.emit('end', {});

    if (input.persist !== false) {
      await db
        .update(messages)
        .set({
          status: 'completed',
          responseBlocks: session.getAllBlocks(),
        })
        .where(
          and(
            eq(messages.chatId, input.chatId),
            eq(messages.messageId, input.messageId),
          ),
        )
        .execute();
    }
  }
}

export default SearchAgent;
