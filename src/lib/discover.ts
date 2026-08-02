import { searchSearxng } from '@/lib/searxng';

export const discoverTopics = [
  { display: 'Tech & Science', key: 'tech' },
  { display: 'Finance', key: 'finance' },
  { display: 'Art & Culture', key: 'art' },
  { display: 'Sports', key: 'sports' },
  { display: 'Entertainment', key: 'entertainment' },
] as const;

const websitesForTopic = {
  tech: {
    query: ['technology news', 'latest tech', 'AI', 'science and innovation'],
    links: ['techcrunch.com', 'wired.com', 'theverge.com'],
  },
  finance: {
    query: ['finance news', 'economy', 'stock market', 'investing'],
    links: ['bloomberg.com', 'cnbc.com', 'marketwatch.com'],
  },
  art: {
    query: ['art news', 'culture', 'modern art', 'cultural events'],
    links: ['artnews.com', 'hyperallergic.com', 'theartnewspaper.com'],
  },
  sports: {
    query: ['sports news', 'latest sports', 'cricket football tennis'],
    links: ['espn.com', 'bbc.com/sport', 'skysports.com'],
  },
  entertainment: {
    query: ['entertainment news', 'movies', 'TV shows', 'celebrities'],
    links: ['hollywoodreporter.com', 'variety.com', 'deadline.com'],
  },
};

export type DiscoverTopic = keyof typeof websitesForTopic;

export const isDiscoverTopic = (t: string): t is DiscoverTopic =>
  t in websitesForTopic;

export const getDiscoverArticles = async (
  topic: DiscoverTopic,
  mode: 'normal' | 'preview' = 'normal',
): Promise<any[]> => {
  const selectedTopic = websitesForTopic[topic];

  if (mode === 'preview') {
    return (
      await searchSearxng(
        `site:${selectedTopic.links[Math.floor(Math.random() * selectedTopic.links.length)]} ${selectedTopic.query[Math.floor(Math.random() * selectedTopic.query.length)]}`,
        {
          engines: ['bing news'],
          pageno: 1,
          language: 'en',
        },
      )
    ).results;
  }

  const seenUrls = new Set();

  return (
    await Promise.all(
      selectedTopic.links.flatMap((link) =>
        selectedTopic.query.map(async (query) => {
          return (
            await searchSearxng(`site:${link} ${query}`, {
              engines: ['bing news'],
              pageno: 1,
              language: 'en',
            })
          ).results;
        }),
      ),
    )
  )
    .flat()
    .filter((item) => {
      const url = item.url?.toLowerCase().trim();
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    })
    .sort(() => Math.random() - 0.5);
};
