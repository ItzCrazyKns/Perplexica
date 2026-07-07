// Pure result mapper — no runtime imports, so it can be unit-tested in isolation.
// You.com result: { title, url, snippet/description, content? }
// → SearXNG-compatible: { title, url, content }

export interface MappedSearchResult {
  title: string;
  url: string;
  content: string;
}

export const mapYoucomResults = (raw: unknown): MappedSearchResult[] => {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter(
      (r) => r && typeof r.url === 'string' && (r.url as string).length > 0,
    )
    .map((r) => {
      const url = r.url as string;
      const snippet =
        (typeof r.snippet === 'string' && r.snippet) ||
        (typeof r.description === 'string' && r.description) ||
        (typeof r.content === 'string' && r.content) ||
        '';
      return {
        title: typeof r.title === 'string' ? r.title : url,
        url,
        content: snippet,
      };
    });
};
