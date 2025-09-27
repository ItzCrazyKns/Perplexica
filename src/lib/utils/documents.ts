import {
  loadCachedRecord,
  purgeWebCache,
  writeCachedRecord,
} from '@/lib/utils/webCache';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import { YoutubeLoader } from '@langchain/community/document_loaders/web/youtube';
import { Document } from '@langchain/core/documents';
import { Readability } from '@mozilla/readability';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import pdfParse from 'pdf-parse';
import { chromium, Page, Browser, BrowserContext } from 'playwright';
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf';

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

export const retrievePdfDoc = async (url: string): Promise<Document | null> => {
  try {
    // Read pdf into a Blob and pass to WebPDFLoader
    console.log(
      '[retrievePdfDoc] Retrieving PDF content for URL:',
      url,
    );
    const cached = await loadCachedRecord(url + '_pdf');
    if (cached) {
      console.log(
        '[retrievePdfDoc] Typed content found in cache for URL:',
        url,
      );
      return new Document({
        pageContent: cached.pageContent || '',
        metadata: {
          title: cached.title || '',
          url: cached.url,
          html: cached.html || undefined,
          ...cached.metadata,
        },
      });
    }
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    const pdfBlob = new Blob([res.data], { type: 'application/pdf' });
    const pdfLoader = new WebPDFLoader(pdfBlob, { splitPages: false });
    const docs = await pdfLoader.load();
    console.log(
      '[retrievePdfDoc] PDF content retrieved successfully:',
      docs,
    );
    if (docs.length > 0) {
      docs[0].metadata.url = url;
      docs[0].metadata.title = docs[0].metadata.title || 'PDF Document';
      // Write to cache
      await writeCachedRecord(url + '_pdf', docs[0]);
      return docs[0];
    }
  } catch (error) {
    console.error('[retrievePdfDoc] Error retrieving PDF content:', error);
  }
  return null;
};

export const retrieveYoutubeTranscript = async (url: string): Promise<Document | null> => {
  try {
    console.log(
      '[retrieveYoutubeTranscript] Retrieving YouTube transcript for URL:',
      url,
    );
    const cached = await loadCachedRecord(url + '_youtube');
    if (cached) {
      console.log(
        '[retrieveYoutubeTranscript] Typed content found in cache for URL:',
        url,
      );
      return new Document({
        pageContent: cached.pageContent || '',
        metadata: {
          title: cached.title || '',
          url: cached.url,
          html: cached.html || undefined,
          ...cached.metadata,
        },
      });
    }

    const transcriptLoader = YoutubeLoader.createFromUrl(url, {
      language: 'en',
      addVideoInfo: true,
    });
    const transcript = await transcriptLoader.load();
    console.log(
      '[retrieveYoutubeTranscript] YouTube transcript retrieved successfully:',
      transcript,
    );
    if (transcript.length > 0) {
      transcript[0].metadata.url = url;
      transcript[0].metadata.title =
        transcript[0].metadata.title || 'YouTube Video Transcript';
      transcript[0].metadata.source = transcript[0].metadata.source || undefined;
      // Write to cache
      await writeCachedRecord(url + '_youtube', transcript[0]);
      return transcript[0];
    }
  } catch (error) {
    console.error('Error retrieving YouTube transcript:', error);
  }
  return null;
};

export const retrieveTypedContentFunc = async (url: string): Promise<Document | null> => {
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    return await retrieveYoutubeTranscript(url);
  } else if (url.endsWith('.pdf')) {
    return await retrievePdfDoc(url);
  }
  return null;
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
 * @param retrieveTypedContent - If true, attempts to retrieve typed content (e.g., youtube transcripts) when applicable.
 * @returns A Promise that resolves to a Document object or null if parsing fails.
 */
export const getWebContent = async (
  url: string,
  truncateToLength: number = 30000,
  getHtml: boolean = false,
  signal?: AbortSignal,
  performAggressiveValidation: boolean = false,
  retrieveTypedContent: boolean = false,
): Promise<Document | null> => {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

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

    // Attempt to retrieve typed content first if enabled
    if (retrieveTypedContent) {
      const typedDoc = await retrieveTypedContentFunc(url);
      if (typedDoc) {
        return typedDoc;
      }
    }

    browser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
    });

    context = await browser.newContext();
    page = await context.newPage();

    // Set a timeout for navigation and content loading
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

    try {
      // Wait an additional 3 seconds for no more network traffic
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch (e) {
      // Ignore timeout errors from waitForLoadState. This is just a best-effort wait.
      // We'll still attempt to get the content even if network isn't fully idle.
      console.warn(`Timeout waiting for networkidle on URL: ${url}`);
    }

    // Best-effort: Playwright loader doesn't expose signal; emulate via early return hooks
    if (signal?.aborted) return null;

    const html = await page.content();

    const dom = new JSDOM(html, { url });
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
      title: article?.title || (await page.title()) || '',
      html: article?.content ?? undefined,
    });

    const returnDoc = new Document({
      pageContent:
        normalizedText.length > truncateToLength
          ? normalizedText.slice(0, truncateToLength)
          : normalizedText,
      metadata: {
        title: article?.title || (await page.title()) || '',
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
  } finally {
    // Ensure browser is closed to prevent resource leaks
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close(); // Theoretically this is the only thing we need to close but we'll close the context and page too for good measure
    } catch (closeError) {
      console.error('Error closing Playwright resources:', closeError);
    }
  }
};
