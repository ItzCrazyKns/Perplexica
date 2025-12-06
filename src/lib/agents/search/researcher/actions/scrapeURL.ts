import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk } from '@/lib/types';
import TurnDown from 'turndown';

const turndownService = new TurnDown();

const schema = z.object({
    urls: z.array(z.string()).describe('A list of URLs to scrape content from.'),
});

const scrapeURLAction: ResearchAction<typeof schema> = {
    name: 'scrape_url',
    description:
        'Use after __plan to scrape and extract content from the provided URLs. This is useful when you need detailed information from specific web pages or if the user asks you to summarize or analyze content from certain links.',
    schema: schema,
    enabled: (_) => true,
    execute: async (params, additionalConfig) => {
        const results: Chunk[] = [];

        await Promise.all(
            params.urls.map(async (url) => {
                try {
                    const res = await fetch(url);
                    const text = await res.text();

                    const title =
                        text.match(/<title>(.*?)<\/title>/i)?.[1] || `Content from ${url}`;
                    const markdown = turndownService.turndown(text);

                    results.push({
                        content: markdown,
                        metadata: {
                            url,
                            title: title,
                        },
                    });
                } catch (error) {
                    results.push({
                        content: `Failed to fetch content from ${url}: ${error}`,
                        metadata: {
                            url,
                            title: `Error fetching ${url}`,
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
