import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import pdfParse from 'pdf-parse';
import { crawlAndEnrich, isFirecrawlEnabled } from '../firecrawl';

export const getDocumentsFromLinks = async ({
  links,
  useFirecrawl,
}: {
  links: string[];
  useFirecrawl?: boolean;
}) => {
  const splitter = new RecursiveCharacterTextSplitter();

  let docs: Document[] = [];

  await Promise.all(
    links.map(async (link) => {
      link =
        link.startsWith('http://') || link.startsWith('https://')
          ? link
          : `https://${link}`;

      try {
        // Try Firecrawl first if enabled and requested by client
        if (isFirecrawlEnabled() && useFirecrawl) {
          console.log('[Firecrawl] scraping', link);
          const enriched = await crawlAndEnrich(link);
          if (
            enriched &&
            (enriched.markdown || enriched.html || enriched.raw)
          ) {
            const baseContent =
              enriched.markdown || enriched.html || enriched.raw || '';
            const parsed = baseContent
              .replace(/(\r\n|\n|\r)/gm, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            const chunks = await splitter.splitText(parsed);
            const meta = enriched.metadata || {};
            const title = meta.title || link;

            const linkDocs = chunks.map(
              (text) =>
                new Document({
                  pageContent: text,
                  metadata: {
                    title,
                    url: link,
                    ...meta,
                  },
                }),
            );

            docs.push(...linkDocs);
            console.log('[Firecrawl] success', link, {
              title: title?.slice(0, 120),
              length: parsed.length,
            });
            return;
          }
          console.log('[Firecrawl] no data, falling back', link);
        }

        // Fallback to legacy HTML/PDF extraction
        const res = await axios.get(link, {
          responseType: 'arraybuffer',
        });

        const isPdf = res.headers['content-type'] === 'application/pdf';

        if (isPdf) {
          const pdfText = await pdfParse(res.data);
          const parsedText = pdfText.text
            .replace(/(\r\n|\n|\r)/gm, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const splittedText = await splitter.splitText(parsedText);
          const title = 'PDF Document';

          const linkDocs = splittedText.map((text) => {
            return new Document({
              pageContent: text,
              metadata: {
                title: title,
                url: link,
              },
            });
          });

          docs.push(...linkDocs);
          return;
        }

        const parsedText = htmlToText(res.data.toString('utf8'), {
          selectors: [
            {
              selector: 'a',
              options: {
                ignoreHref: true,
              },
            },
          ],
        })
          .replace(/(\r\n|\n|\r)/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const splittedText = await splitter.splitText(parsedText);
        const title = res.data
          .toString('utf8')
          .match(/<title.*>(.*?)<\/title>/)?.[1];

        const linkDocs = splittedText.map((text) => {
          return new Document({
            pageContent: text,
            metadata: {
              title: title || link,
              url: link,
            },
          });
        });

        docs.push(...linkDocs);
      } catch (err) {
        console.error(
          'An error occurred while getting documents from links: ',
          err,
        );
        docs.push(
          new Document({
            pageContent: `Failed to retrieve content from the link: ${err}`,
            metadata: {
              title: 'Failed to retrieve content',
              url: link,
            },
          }),
        );
      }
    }),
  );

  return docs;
};
