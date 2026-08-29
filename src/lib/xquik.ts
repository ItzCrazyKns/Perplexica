const XQUIK_SEARCH_URL = 'https://xquik.com/api/v1/x/tweets/search';
const X_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const X_POST_ID_PATTERN = /^\d+$/;

interface XquikSearchResult {
  content: string;
  title: string;
  url: string;
}

interface XquikTweet {
  author?: {
    username?: unknown;
  };
  id?: unknown;
  likeCount?: unknown;
  retweetCount?: unknown;
  text?: unknown;
  viewCount?: unknown;
}

export const isXquikEnabled = (): boolean =>
  Boolean(process.env.XQUIK_API_KEY?.trim());

export const searchXquik = async (
  query: string,
  limit = 10,
): Promise<XquikSearchResult[]> => {
  const apiKey = process.env.XQUIK_API_KEY?.trim();
  if (!apiKey || query.trim() === '') return [];

  const url = new URL(XQUIK_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(clampLimit(limit)));
  url.searchParams.set('queryType', 'Latest');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Xquik search returned HTTP ${response.status}`);
  }

  return parseResults(await response.json());
};

const clampLimit = (limit: number): number => {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
};

const parseResults = (payload: unknown): XquikSearchResult[] => {
  if (!isRecord(payload) || !Array.isArray(payload.tweets)) return [];

  return payload.tweets.flatMap((value) => {
    if (!isRecord(value)) return [];
    return toSearchResult(value);
  });
};

const toSearchResult = (tweet: XquikTweet): XquikSearchResult[] => {
  const id = asString(tweet.id);
  const text = asString(tweet.text);
  const username = isRecord(tweet.author)
    ? asString(tweet.author.username)
    : '';

  if (
    !X_POST_ID_PATTERN.test(id) ||
    !X_USERNAME_PATTERN.test(username) ||
    text === ''
  ) {
    return [];
  }

  const engagement = [
    formatMetric(tweet.likeCount, 'likes'),
    formatMetric(tweet.retweetCount, 'reposts'),
    formatMetric(tweet.viewCount, 'views'),
  ].filter((metric) => metric !== '');

  return [
    {
      content: `${text}${engagement.length > 0 ? ` [${engagement.join(', ')}]` : ''}`,
      title: `@${username}: ${text.slice(0, 120)}`,
      url: `https://x.com/${username}/status/${id}`,
    },
  ];
};

const formatMetric = (value: unknown, label: string): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }
  return `${value} ${label}`;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
