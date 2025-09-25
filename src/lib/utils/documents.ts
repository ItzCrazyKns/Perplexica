import {
  loadCachedRecord,
  purgeWebCache,
  writeCachedRecord,
} from '@/lib/utils/webCache';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import { Document } from '@langchain/core/documents';
import { Readability } from '@mozilla/readability';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import pdfParse from 'pdf-parse';
import type { Browser, Page } from 'playwright';

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
        // First, check if it's a PDF
        const headRes = await axios.head(link);
        const isPdf = headRes.headers['content-type'] === 'application/pdf';

        if (isPdf) {
          // Handle PDF files
          const res = await axios.get(link, {
            responseType: 'arraybuffer',
          });

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

        // Handle web pages using CheerioWebBaseLoader
        const loader = new CheerioWebBaseLoader(link, {
          selector: 'body',
        });

        const webDocs = await loader.load();

        if (webDocs && webDocs.length > 0) {
          const webDoc = webDocs[0];
          // Parse via Readability for better content extraction
          const dom = new JSDOM(webDoc.pageContent, { url: link });
          const reader = new Readability(dom.window.document);
          const article = reader.parse();
          if (!article || !article.textContent) {
            throw new Error('Readability parsing failed for url: ' + link);
          }

          // Normalize the text content
          webDoc.pageContent = article.textContent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join('\n');

          const splittedText = await splitter.splitText(webDoc.pageContent);

          const linkDocs = splittedText.map((text) => {
            return new Document({
              pageContent: text,
              metadata: {
                title: article.title || webDoc.metadata.title || link,
                url: link,
              },
            });
          });

          docs.push(...linkDocs);
        }
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

/**
 * Fetches web content from a given URL using LangChain's PlaywrightWebBaseLoader.
 * Parses it using Readability for better content extraction.
 * Returns a Document object containing the parsed text and metadata.
 *
 * @param url - The URL to fetch content from.
 * @param getHtml - Whether to include the HTML content in the metadata.
 * @param signal - Optional AbortSignal to cancel the operation.
 * @param truncateToLength - Maximum length of the returned text content.
 * @param performAggressiveValidation - If true, performs additional validation on the fetched content. Like ensuring the parsed article has a title and sufficient length.
 * @returns A Promise that resolves to a Document object or null if parsing fails.
 */
export const getWebContent = async (
  url: string,
  truncateToLength: number = 30000,
  getHtml: boolean = false,
  signal?: AbortSignal,
  performAggressiveValidation: boolean = false,
): Promise<Document | null> => {
  try {
    if (signal?.aborted) {
      console.warn(`getWebContent aborted before start for URL: ${url}`);
      return null;
    }
    // Opportunistic purge then try cache
    await purgeWebCache();

    // Cache hit path (in-memory or disk)
    const cached = await loadCachedRecord(url);
    if (cached) {
      const docFromCache = new Document({
        pageContent: cached.pageContent || '',
        metadata: {
          title: cached.title || '',
          url: cached.url,
          html: getHtml ? cached.html : undefined,
        },
      });
      return docFromCache;
    }

    console.log(`Fetching content from URL: ${url}`);

    const loader = new PlaywrightWebBaseLoader(url, {
      launchOptions: {
        headless: true,
        timeout: 30000,
        //chromiumSandbox: true,
      },
      gotoOptions: {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      },
      async evaluate(page: Page, browser: Browser) {
        // Wait for the content to load properly
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        // Allow some time for dynamic content to load
        await page.waitForTimeout(3000);

        const content = await page.content();
        browser.close();

        return content;
      },
    });

    // Best-effort: Playwright loader doesn't expose signal; emulate via early return hooks
    if (signal?.aborted) return null;
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      console.warn(`Failed to load content for URL: ${url}`);
      return null;
    }

    const doc = docs[0];

    const dom = new JSDOM(doc.pageContent, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (
      performAggressiveValidation &&
      (!article ||
        !article.title ||
        !article.textContent ||
        article.textContent.length < 200 ||
        article.title.length < 5)
    ) {
      throw new Error(
        'Readability parsing failed or returned insufficient content for Playwright-loaded page on url: ' +
          url,
      );
    }

    // Normalize the text content
    const normalizedText =
      article?.textContent
        ?.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .join('\n') || '';

    // Write to cache (store html regardless of getHtml flag)
    await writeCachedRecord(url, {
      pageContent: normalizedText,
      title: article?.title || doc.metadata.title || '',
      html: article?.content ?? undefined,
    });

    const returnDoc = new Document({
      pageContent:
        normalizedText.length > truncateToLength
          ? normalizedText.slice(0, truncateToLength)
          : normalizedText,
      metadata: {
        title: article?.title || doc.metadata.title || '',
        url: url,
        html: getHtml ? article?.content : undefined,
      },
    });

    console.log(
      `Got content with LangChain Playwright, URL: ${url}, Text Length: ${returnDoc.pageContent.length}, Truncated: ${normalizedText.length > truncateToLength}`,
    );

    return returnDoc;
  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`, error);

    // Fallback to CheerioWebBaseLoader for simpler content extraction
    try {
      console.log(`Fallback to Cheerio for URL: ${url}`);
      const cheerioLoader = new CheerioWebBaseLoader(url, { maxRetries: 2 });
      if (signal?.aborted) return null;
      const docs = await cheerioLoader.load();

      if (docs && docs.length > 0) {
        const doc = docs[0];

        // Apply Readability to extract meaningful content from Cheerio HTML
        const dom = new JSDOM(doc.pageContent, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (
          performAggressiveValidation &&
          (!article ||
            !article.title ||
            !article.textContent ||
            article.textContent.length < 200 ||
            article.title.length < 5)
        ) {
          console.log(
            `Cheerio fallback also failed Readability validation for URL: ${url}`,
          );
          return null;
        }

        // Normalize the text content
        const normalizedText =
          article?.textContent
            ?.split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .join('\n') || '';

        // Write to cache
        await writeCachedRecord(url, {
          pageContent: normalizedText,
          title: article?.title || doc.metadata.title || '',
          html: article?.content ?? undefined,
        });

        const returnDoc = new Document({
          pageContent:
            normalizedText.length > truncateToLength
              ? normalizedText.slice(0, truncateToLength)
              : normalizedText,
          metadata: {
            title: article?.title || doc.metadata.title || '',
            url: url,
            html: getHtml ? article?.content : undefined,
          },
        });

        console.log(
          `Got content with Cheerio fallback + Readability, URL: ${url}, Text Length: ${returnDoc.pageContent.length} Truncated: ${normalizedText.length > truncateToLength}`,
        );

        return returnDoc;
      }
    } catch (fallbackError) {
      console.error(
        `Cheerio fallback also failed for URL ${url}:`,
        fallbackError,
      );
    }

    return null;
  }
};
