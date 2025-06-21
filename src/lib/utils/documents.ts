import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { Readability } from '@mozilla/readability';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fetch from 'node-fetch';
import pdfParse from 'pdf-parse';
import type { Browser, Page } from 'playwright';
import computeSimilarity from './computeSimilarity';

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
          const splittedText = await splitter.splitText(webDoc.pageContent);

          const linkDocs = splittedText.map((text) => {
            return new Document({
              pageContent: text,
              metadata: {
                title: webDoc.metadata.title || link,
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
 * @returns A Promise that resolves to a Document object or null if parsing fails.
 */
export const getWebContent = async (
  url: string,
  getHtml: boolean = false,
): Promise<Document | null> => {
  try {
    console.log(`Fetching content from URL: ${url}`);

    const loader = new PlaywrightWebBaseLoader(url, {
      launchOptions: {
        headless: true,
        timeout: 30000,
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

        return await page.content();
      },
    });

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      console.warn(`Failed to load content for URL: ${url}`);
      return null;
    }

    const doc = docs[0];

    const dom = new JSDOM(doc.pageContent, { url });
    const reader = new Readability(dom.window.document, { charThreshold: 25 });
    const article = reader.parse();

    // Normalize the text content
    const normalizedText =
      article?.textContent
        ?.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .join('\n') || '';

    const returnDoc = new Document({
      pageContent: normalizedText,
      metadata: {
        title: article?.title || doc.metadata.title || '',
        url: url,
        html: getHtml ? article?.content : undefined,
      },
    });

    console.log(
      `Got content with LangChain Playwright, URL: ${url}, Text Length: ${returnDoc.pageContent.length}`,
    );

    return returnDoc;
  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`, error);

    // Fallback to CheerioWebBaseLoader for simpler content extraction
    try {
      console.log(`Fallback to Cheerio for URL: ${url}`);
      const cheerioLoader = new CheerioWebBaseLoader(url);
      const docs = await cheerioLoader.load();

      if (docs && docs.length > 0) {
        return docs[0];
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

/**
 * Fetches web content from a given URL using CheerioWebBaseLoader for faster, lighter extraction.
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
    console.log(`Fetching content (lite) from URL: ${url}`);

    const loader = new CheerioWebBaseLoader(url);

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      console.warn(`Failed to load content for URL: ${url}`);
      return null;
    }

    const doc = docs[0];

    // Try to use Readability for better content extraction if possible
    if (getHtml) {
      try {
        const response = await fetch(url, { timeout: 5000 });
        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const originalTitle = dom.window.document.title;
        const reader = new Readability(dom.window.document, {
          charThreshold: 25,
        });
        const article = reader.parse();

        if (article) {
          const normalizedText =
            article.textContent
              ?.split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .join('\n') || '';

          return new Document({
            pageContent: normalizedText,
            metadata: {
              html: article.content,
              title: article.title || originalTitle,
              url: url,
            },
          });
        }
      } catch (readabilityError) {
        console.warn(
          `Readability parsing failed for ${url}, using Cheerio fallback`,
        );
      }
    }

    // Normalize the text content from Cheerio
    const normalizedText = doc.pageContent
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .join('\n');

    return new Document({
      pageContent: normalizedText,
      metadata: {
        title: doc.metadata.title || 'Web Page',
        url: url,
        html: getHtml ? doc.pageContent : undefined,
      },
    });
  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`, error);
    return null;
  }
};

/**
 * Fetches web content from a given URL using LangChain's PlaywrightWebBaseLoader.
 * Parses it using Readability for better content extraction.
 * Returns a Document object containing relevant snippets of text using ranked text splitting.
 * Text is split into chunks of approximately 800 characters, with 100 characters overlap.
 *
 * @param url - The URL to fetch content from.
 * @param rankAgainstVector - The vector to rank the content against for relevance.
 * @param embeddings - The embeddings model to use for ranking the content.
 * @returns A Promise that resolves to a Document object or null if parsing fails.
 */
export const getRankedWebContentSnippets = async (
  url: string,
  rankAgainstVector: number[],
  embeddings: Embeddings,
): Promise<Document | null> => {
  try {
    console.log(`Fetching ranked content snippets from URL: ${url}`);

    const loader = new PlaywrightWebBaseLoader(url, {
      launchOptions: {
        headless: true,
        timeout: 30000,
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

        return await page.content();
      },
    });

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      console.warn(`Failed to load content for URL: ${url}`);
      return null;
    }

    const doc = docs[0];

    const dom = new JSDOM(doc.pageContent, { url });
    const reader = new Readability(dom.window.document, {
      charThreshold: 25,
    });
    const article = reader.parse();

    // Split text into chunks with specified parameters
    const splitter = RecursiveCharacterTextSplitter.fromLanguage('html', {
      chunkSize: 800,
      chunkOverlap: 100,
    });

    const textChunks = await splitter.splitText(article?.content || '');
    if (!textChunks || textChunks.length === 0) {
      console.warn(`No text chunks found for URL: ${url}`);
      return null;
    }

    const similarity = await Promise.all(
      textChunks.map(async (chunk, i) => {
        const sim = computeSimilarity(
          rankAgainstVector,
          (await embeddings.embedDocuments([chunk]))[0],
        );
        return {
          index: i,
          similarity: sim,
        };
      }),
    );

    let rankedChunks = similarity
      .sort((a, b) => b.similarity - a.similarity)
      .map((sim) => textChunks[sim.index])
      .slice(0, 5);

    // Combine chunks into a single document with the most relevant content
    const combinedContent = rankedChunks.join('\n\n');

    const returnDoc = new Document({
      pageContent: combinedContent,
      metadata: {
        title: article?.title || doc.metadata.title || '',
        url: url,
        chunks: rankedChunks.length,
      },
    });

    console.log(
      `Got ranked content snippets, URL: ${url}, Chunks: ${rankedChunks.length}, Total Length: ${returnDoc.pageContent.length}`,
    );

    return returnDoc;
  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`, error);

    // Fallback to CheerioWebBaseLoader for simpler content extraction
    // try {
    //   console.log(`Fallback to Cheerio for URL: ${url}`);
    //   const cheerioLoader = new CheerioWebBaseLoader(url);
    //   const docs = await cheerioLoader.load();

    //   if (docs && docs.length > 0) {
    //     const doc = docs[0];

    //     // Apply the same splitting logic to fallback content
    //     const splitter = new RecursiveCharacterTextSplitter({
    //       chunkSize: 800,
    //       chunkOverlap: 100,
    //     });

    //     const textChunks = await splitter.splitText(doc.pageContent);
    //     const combinedContent = textChunks.join('\n\n');

    //     return new Document({
    //       pageContent: combinedContent,
    //       metadata: {
    //         title: doc.metadata.title || '',
    //         url: url,
    //         chunks: textChunks.length,
    //       },
    //     });
    //   }
    // } catch (fallbackError) {
    //   console.error(
    //     `Cheerio fallback also failed for URL ${url}:`,
    //     fallbackError,
    //   );
    // }

    return null;
  }
};
