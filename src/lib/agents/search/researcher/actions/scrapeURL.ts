import z from 'zod';
import {
  extractorPrompt,
  extractorSchema,
} from '@/lib/prompts/search/extractor';
import { ResearchAction } from '../../types';
import { Chunk, ReadingResearchBlock } from '@/lib/types';
import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';
import { normalizeUrl } from '../../urlAllowlist';

const schema = z.object({
  urls: z.array(z.string()).describe('A list of URLs to scrape content from.'),
});

const actionDescription = `
Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.
You should only call this tool when the user has specifically requested information from certain web pages, never call this yourself to get extra information without user instruction.

For example, if the user says "Please summarize the content of https://example.com/article", you can call this tool with that URL to get the content and then provide the summary or "What does X mean according to https://example.com/page", you can call this tool with that URL to get the content and provide the explanation.
`;

const scrapeURLAction: ResearchAction<typeof schema> = {
  name: 'scrape_url',
  schema: schema,
  getToolDescription: () =>
    'Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.',
  getDescription: () => actionDescription,
  enabled: (_) => true,
  execute: async (params, additionalConfig) => {
    const requested = params.urls.slice(0, 3);

    /* The model's context contains scraped page text, so a page can
       ask for any URL; only user-typed or search-surfaced ones pass. */
    const blocked = requested.filter(
      (url) => !additionalConfig.allowedScrapeUrls.has(normalizeUrl(url)),
    );
    params.urls = requested.filter((url) =>
      additionalConfig.allowedScrapeUrls.has(normalizeUrl(url)),
    );

    let readingBlockId = crypto.randomUUID();
    let readingEmitted = false;

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    const results: Chunk[] = blocked.map((url) => ({
      content: `Scraping ${url} is not permitted: only URLs the user provided or that appeared in search results may be scraped.`,
      metadata: {
        url,
        title: `Blocked scrape of ${url}`,
      },
    }));

    await Promise.all(
      params.urls.map(async (url) => {
        try {
          const scraped = await additionalConfig.budget
            .run(() => Scraper.scrape(url))
            .catch(async (err) => {
              /* News aggregators append a numeric id segment that
                 404s; retry once without it. */
              const stripped = url.replace(/\/\d{6,}\/?$/, '');
              if (stripped === url) throw err;
              return additionalConfig.budget.run(() =>
                Scraper.scrape(stripped),
              );
            });

          if (!scraped) {
            results.push({
              content: `Skipped ${url}: research budget exhausted.`,
              metadata: { url, title: url },
            });
            return;
          }

          if (
            !readingEmitted &&
            researchBlock &&
            researchBlock.type === 'research'
          ) {
            readingEmitted = true;
            researchBlock.data.subSteps.push({
              id: readingBlockId,
              type: 'reading',
              reading: [
                {
                  content: '',
                  metadata: {
                    url,
                    title: scraped.title,
                  },
                },
              ],
            });

            additionalConfig.session.updateBlock(
              additionalConfig.researchBlockId,
              [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: researchBlock.data.subSteps,
                },
              ],
            );
          } else if (
            readingEmitted &&
            researchBlock &&
            researchBlock.type === 'research'
          ) {
            const subStepIndex = researchBlock.data.subSteps.findIndex(
              (step: any) => step.id === readingBlockId,
            );

            const subStep = researchBlock.data.subSteps[
              subStepIndex
            ] as ReadingResearchBlock;

            subStep.reading.push({
              content: '',
              metadata: {
                url,
                title: scraped.title,
              },
            });

            additionalConfig.session.updateBlock(
              additionalConfig.researchBlockId,
              [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: researchBlock.data.subSteps,
                },
              ],
            );
          }

          const chunks = splitText(scraped.content, 4000, 500);

          let accumulatedContent = '';

          if (chunks.length > 1) {
            try {
              await Promise.all(
                chunks.map(async (chunk) => {
                  const extracted = await additionalConfig.budget.run(() =>
                    additionalConfig.llm.generateObject<typeof extractorSchema>(
                      {
                        messages: [
                          {
                            role: 'system',
                            content: extractorPrompt,
                          },
                          {
                            role: 'user',
                            content: `<queries>Summarize</queries>\n<scraped_data>${chunk}</scraped_data>`,
                          },
                        ],
                        schema: extractorSchema,
                      },
                    ),
                  );

                  if (!extracted) return;

                  accumulatedContent += extracted.extracted_facts + '\n';
                }),
              );
            } catch (err) {
              console.log(
                'Error during extraction, falling back to raw content',
                err,
              );
              accumulatedContent = chunks[0];
            }
          } else {
            accumulatedContent = scraped.content;
          }

          results.push({
            content: accumulatedContent,
            metadata: {
              url,
              title: scraped.title,
            },
          });
        } catch (error) {
          results.push({
            content: `Failed to fetch content from ${url}: ${error}`,
            metadata: {
              url,
              title: `Error scraping ${url}`,
            },
          });
        }
      }),
    );

    return {
      type: 'search_results',
      results,
    };
  },
};

export default scrapeURLAction;
