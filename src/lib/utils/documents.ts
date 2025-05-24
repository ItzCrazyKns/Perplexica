import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import pdfParse from 'pdf-parse';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
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

export const getWebContent = async (
  url: string,
  getHtml: boolean = false,
): Promise<Document | null> => {
  try {
    const response = await fetch(url, { timeout: 5000 });
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

    // Normalize the text content by removing extra spaces and newlines. Iterate through the lines one by one and throw out the ones that are empty or contain only whitespace.
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
        excerpt: article.excerpt || undefined,
        byline: article.byline || undefined,
        siteName: article.siteName || undefined,
        readingTime: article.length
          ? Math.ceil(article.length / 1000)
          : undefined,
      },
    });
  } catch (error) {
    console.error(`Error fetching/parsing URL ${url}:`); //, error);
    return null;
  }
};
