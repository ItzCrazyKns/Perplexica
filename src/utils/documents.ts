import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import pdfParse from 'pdf-parse';
import logger from './logger';
import { getJinaApiKey } from '../config';

export const getDocumentsFromLinks = async ({ links }: { links: string[] }) => {

  links = links.map(link => link.startsWith('http://') || link.startsWith('https://')
    ? link
    : `https://${link}`)

  if (getJinaApiKey()) {
    return await getDocumentsFromJinaReader({ links });
  }

  return await getDocumentsFromLocal({ links });
};

const getDocumentsFromLocal = async ({links}: {links: string[]}) => {
  const splitter = new RecursiveCharacterTextSplitter();
  let docs: Document[] = [];

  await Promise.all(
    links.map(async (link) => {
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
          .match(/<title>(.*?)<\/title>/)?.[1];

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
        logger.error(
          `Error at generating documents from links: ${err.message}`,
        );
        docs.push(
          new Document({
            pageContent: `Failed to retrieve content from the link: ${err.message}`,
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

const getDocumentsFromJinaReader = async ({links}: { links: string[] }) => {
  const splitter = new MarkdownTextSplitter();
  let docs: Document[] = [];

  await Promise.all(
    links.map(async link => {
      try {
        const res = await axios.get(`https://r.jina.ai/${link}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getJinaApiKey()}`,
          }
        });

        if(res.data.code === 200) {
          const data = res.data.data
          const splittedText = await splitter.splitText(data.content);
          const linkDocs = splittedText.map((text) => {
            return new Document({
              pageContent: text,
              metadata: {
                title: data.title,
                url: link,
              },
            });
          });

          docs.push(...linkDocs);
          return;
        } else {
          docs.push(
            new Document({
              pageContent: `Failed to retrieve content from the link in the Jina reader API, code: ${res.data.code}`,
              metadata: {
                title: 'Failed to retrieve content',
                url: link,
              },
            }),
          );
        }
      } catch (err) {
        docs.push(
          new Document({
            pageContent: `Failed to retrieve content from the link: ${err.message}`,
            metadata: {
              title: 'Failed to retrieve content',
              url: link,
            },
          }),
        );
      }
    })
  );
  return docs;
};
