import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import pdfParse from 'pdf-parse';
import { Configuration, Dataset, PlaywrightCrawler } from 'crawlee';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

export const getDocumentsFromLinks = async ({ links }: { links: string[] }) => {
  const splitter = new RecursiveCharacterTextSplitter();

  let docs: Document[] = [];

  await Promise.all(
    links.map(async (link) => {
      link =
        link.startsWith('http://') || link.startsWith('https://')
          ? link
          : `https://${link}`;

      try {
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

interface CrawledContent {
  text: string;
  title: string;
  html?: string;
}

/**
 * Fetches web content from a given URL using Crawlee and Playwright. Parses it using Readability.
 * Returns a Document object containing the parsed text and metadata.
 *
 * @param url - The URL to fetch content from.
 * @param getHtml - Whether to include the HTML content in the metadata.
 * @returns A Promise that resolves to a Document object or null if parsing fails.
 */
export const getWebContent = async (
  url: string,
  getHtml: boolean = false,
): Promise<Document | null> => {
  let crawledContent: CrawledContent | null = null;
  const crawler = new PlaywrightCrawler({
      async requestHandler({ page }) {
        // Wait for the content to load
        await page.waitForLoadState('networkidle', {timeout: 10000});

        // Allow some time for dynamic content to load
        await page.waitForTimeout(3000);

        console.log(`Crawling URL: ${url}`);

        // Get the page title
        const title = await page.title();

        try {
          // Use Readability to parse the page content
          const content = await page.content();
          const dom = new JSDOM(content, { url });
          const reader = new Readability(dom.window.document, { charThreshold: 25 }).parse();
          const crawleeContent: CrawledContent = {
            text: reader?.textContent || '',
            title,
            html: getHtml ? reader?.content || await page.content() : undefined,
          };

          crawledContent = crawleeContent;
        } catch (error) {
          console.error(`Failed to parse content with Readability for URL: ${url}`, error);
        }

      },
      maxRequestsPerCrawl: 1,
      maxRequestRetries: 2,
      retryOnBlocked: true,
      maxSessionRotations: 3,
    }, new Configuration({ persistStorage: false }));

  try {
    await crawler.run([url]);

    if (!crawledContent) {
      console.warn(`Failed to parse article content for URL: ${url}`);
      return null;
    }

    const content = crawledContent as CrawledContent;

    // Normalize the text content
    const normalizedText = content?.text
      ?.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .join('\n') || '';

    // Create a Document with the parsed content
    const returnDoc = new Document({
      pageContent: normalizedText,
      metadata: {
        html: content?.html,
        title: content?.title,
        url: url,
      },
    });


    console.log(`Got content with Crawlee and Readability, URL: ${url}, Text Length: ${returnDoc.pageContent.length}, html Length: ${returnDoc.metadata.html?.length || 0}`);
    return returnDoc;

  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`, error);
    return null;
  } finally {
    await crawler.teardown();
  }
};

/**
 * Fetches web content from a given URL and parses it using Readability.
 * Returns a Document object containing the parsed text and metadata.
 *
 * @param {string} url - The URL to fetch content from.
 * @param {boolean} getHtml - Whether to include the HTML content in the metadata.
 * @returns {Promise<Document | null>} A Promise that resolves to a Document object or null if parsing fails.
 */
export const getWebContentLite = async (
  url: string,
  getHtml: boolean = false,
): Promise<Document | null> => {
  try {
    const response = await fetch(url, {timeout: 5000});
    const html = await response.text();

    // Create a DOM from the fetched HTML
    const dom = new JSDOM(html, { url });

    // Get title before we modify the DOM
    const originalTitle = dom.window.document.title;

    // Use Readability to parse the article content
    const reader = new Readability(dom.window.document, { charThreshold: 25 });
    const article = reader.parse();

    if (!article) {
      console.warn(`Failed to parse article content for URL: ${url}`);
      return null;
    }

    const normalizedText =
      article?.textContent
        ?.split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n') || '';

    // Create a Document with the parsed content
    return new Document({
      pageContent: normalizedText || '',
      metadata: {
        html: getHtml ? article.content : undefined,
        title: article.title || originalTitle,
        url: url,
      },
    });
  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`); //, error);
    return null;
  }
};