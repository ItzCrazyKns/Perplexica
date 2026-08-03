import { extractUserUrls } from './urlAllowlist';

/*
 * 'Summary: <url>' (Discover click-throughs) and close variants are a
 * focused task: fetch the article and summarize it. Running the full
 * research loop on top buried the article under dozens of loosely
 * related search results and misled the writer. Full research remains
 * the fallback when the page cannot be fetched.
 */
export const detectSummaryIntent = (followUp: string): string[] | null => {
  const urls = extractUserUrls(followUp);
  if (urls.length === 0) return null;

  let rest = followUp;
  for (const u of urls) rest = rest.split(u).join(' ');
  rest = rest.replace(/[\s:;,.!?-]+/g, ' ').trim();

  const words = rest.split(' ').filter(Boolean);
  const summaryVerb =
    /^(please\s+|can you\s+)*(summar|r[eé]sum|tl;?dr|synth[eé]|digest|recap)/i.test(
      rest,
    );

  /* A bare pasted link means the same thing as 'Summary:'. Anything
     with a real question falls through to full research (which still
     pre-scrapes the URL). */
  if (summaryVerb || words.length <= 3) return urls.slice(0, 3);
  return null;
};
