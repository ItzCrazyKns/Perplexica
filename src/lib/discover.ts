import { searchSearxng } from '@/lib/searxng';
import { getDiscoverRegion } from '@/lib/config/serverRegistry';

export const discoverTopics = [
  { display: 'Tech & Science', key: 'tech' },
  { display: 'Finance', key: 'finance' },
  { display: 'Art & Culture', key: 'art' },
  { display: 'Sports', key: 'sports' },
  { display: 'Entertainment', key: 'entertainment' },
] as const;

/* English-language sources split by region; 'global' merges both.
   Selectable in Settings > Search (search.discoverRegion). */
const websitesForTopic: Record<
  string,
  { query: string[]; us: string[]; eu: string[] }
> = {
  tech: {
    query: ['technology news', 'latest tech', 'AI', 'science and innovation'],
    us: ['techcrunch.com', 'wired.com', 'theverge.com'],
    eu: ['thenextweb.com', 'theregister.com', 'sifted.eu'],
  },
  finance: {
    query: ['finance news', 'economy', 'stock market', 'investing'],
    us: ['bloomberg.com', 'cnbc.com', 'marketwatch.com'],
    eu: ['ft.com', 'reuters.com', 'politico.eu'],
  },
  art: {
    query: ['art news', 'culture', 'modern art', 'cultural events'],
    us: ['artnews.com', 'hyperallergic.com'],
    eu: ['theartnewspaper.com', 'artreview.com', 'euronews.com'],
  },
  sports: {
    query: ['sports news', 'latest sports', 'football tennis cycling'],
    us: ['espn.com', 'si.com', 'cbssports.com'],
    eu: ['bbc.com/sport', 'skysports.com', 'theguardian.com/sport'],
  },
  entertainment: {
    query: ['entertainment news', 'movies', 'TV shows', 'celebrities'],
    us: ['hollywoodreporter.com', 'variety.com', 'deadline.com'],
    eu: ['theguardian.com/culture', 'bbc.com/culture', 'screendaily.com'],
  },
};

export type DiscoverTopic = keyof typeof websitesForTopic;

export const isDiscoverTopic = (t: string): t is DiscoverTopic =>
  t in websitesForTopic;

const sitesFor = (topic: DiscoverTopic): string[] => {
  const region = getDiscoverRegion();
  const t = websitesForTopic[topic];

  if (region === 'us') return t.us;
  if (region === 'eu') return t.eu;
  return [...t.eu, ...t.us];
};

/* Newest first; missing dates sink; same-day order randomized so the
   page does not look frozen between cache refreshes. */
const sortByFreshness = (items: any[]): any[] => {
  const day = (r: any) => {
    const t = Date.parse(r.publishedDate ?? '');
    return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  };

  const jitter = new Map(items.map((r) => [r, Math.random()]));

  return [...items].sort((a, b) => {
    const da = day(a);
    const db = day(b);
    if (da === db) return jitter.get(a)! - jitter.get(b)!;
    if (da === null) return 1;
    if (db === null) return -1;
    return db.localeCompare(da);
  });
};

/* One topic view previously fired 12 upstream searches per request
   with no cache, feeding straight into engine rate limits on a single
   residential egress. The promise is cached, not the result, so
   concurrent first hits share one fan-out. */
const CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_SEARCHES_PER_REFRESH = 12;
const cache = new Map<string, { at: number; data: Promise<any[]> }>();

const fetchArticles = async (topic: DiscoverTopic): Promise<any[]> => {
  const selectedTopic = websitesForTopic[topic];
  const sites = sitesFor(topic);

  let pairs = sites.flatMap((link) =>
    selectedTopic.query.map((query) => ({ link, query })),
  );

  if (pairs.length > MAX_SEARCHES_PER_REFRESH) {
    pairs = pairs
      .map((p) => ({ p, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .slice(0, MAX_SEARCHES_PER_REFRESH)
      .map(({ p }) => p);
  }

  const seenUrls = new Set();

  const results = (
    await Promise.all(
      pairs.map(async ({ link, query }) => {
        try {
          return (
            await searchSearxng(`site:${link} ${query}`, {
              /* The news category fans out across every enabled news
                 engine, so one suspended engine degrades results
                 instead of emptying the tab. */
              categories: ['news'],
              pageno: 1,
              language: 'en',
            })
          ).results;
        } catch (err) {
          console.error(`Discover search failed for ${link}:`, err);
          return [];
        }
      }),
    )
  )
    .flat()
    .filter((item) => {
      const url = item.url?.toLowerCase().trim();
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });

  return sortByFreshness(results);
};

export const getDiscoverArticles = async (
  topic: DiscoverTopic,
  mode: 'normal' | 'preview' = 'normal',
): Promise<any[]> => {
  const key = `${topic}:${getDiscoverRegion()}`;
  const cached = cache.get(key);

  let data: Promise<any[]>;

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    data = cached.data;
  } else {
    data = fetchArticles(topic);
    cache.set(key, { at: Date.now(), data });
    /* A failed refresh must not poison the cache for 20 minutes. */
    data.catch(() => cache.delete(key));
  }

  const articles = await data;

  if (mode === 'preview') {
    const withThumbs = articles.filter((a) => a.thumbnail);
    return withThumbs.slice(0, 12).sort(() => Math.random() - 0.5);
  }

  return articles;
};
