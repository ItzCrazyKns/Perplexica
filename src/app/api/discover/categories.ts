/**
 * Default categories and functions for generating search queries
 */

import { LANGUAGE_SPECIFIC_SOURCES } from './languages';

/**
 * Default English categories and their sources
 */
export const DEFAULT_CATEGORIES: Record<string, { site: string; keyword: string }[]> = {
  'Technology': [
    { site: 'techcrunch.com', keyword: 'tech' },
    { site: 'wired.com', keyword: 'technology' },
    { site: 'theverge.com', keyword: 'tech' },
    { site: 'arstechnica.com', keyword: 'technology' },
    { site: 'thenextweb.com', keyword: 'tech' }
  ],
  'AI': [
    { site: 'ai.googleblog.com', keyword: 'AI' },
    { site: 'openai.com/blog', keyword: 'AI' },
    { site: 'venturebeat.com', keyword: 'artificial intelligence' },
    { site: 'techcrunch.com', keyword: 'artificial intelligence' },
    { site: 'technologyreview.mit.edu', keyword: 'AI' }
  ],
  'Sports': [
    { site: 'espn.com', keyword: 'sports' },
    { site: 'sports.yahoo.com', keyword: 'sports' },
    { site: 'cbssports.com', keyword: 'sports' },
    { site: 'si.com', keyword: 'sports' },
    { site: 'bleacherreport.com', keyword: 'sports' }
  ],
  'Money': [
    { site: 'bloomberg.com', keyword: 'finance' },
    { site: 'cnbc.com', keyword: 'money' },
    { site: 'wsj.com', keyword: 'finance' },
    { site: 'ft.com', keyword: 'finance' },
    { site: 'economist.com', keyword: 'economy' }
  ],
  'Gaming': [
    { site: 'ign.com', keyword: 'games' },
    { site: 'gamespot.com', keyword: 'gaming' },
    { site: 'polygon.com', keyword: 'games' },
    { site: 'kotaku.com', keyword: 'gaming' },
    { site: 'eurogamer.net', keyword: 'games' }
  ],
  'Entertainment': [
    { site: 'variety.com', keyword: 'entertainment' },
    { site: 'hollywoodreporter.com', keyword: 'entertainment' },
    { site: 'ew.com', keyword: 'entertainment' },
    { site: 'deadline.com', keyword: 'entertainment' },
    { site: 'rollingstone.com', keyword: 'entertainment' }
  ],
  'Art and Culture': [
    { site: 'artnews.com', keyword: 'art' },
    { site: 'artsy.net', keyword: 'art' },
    { site: 'theartnewspaper.com', keyword: 'art' },
    { site: 'nytimes.com/section/arts', keyword: 'culture' },
    { site: 'culturalweekly.com', keyword: 'culture' }
  ],
  'Science': [
    { site: 'scientificamerican.com', keyword: 'science' },
    { site: 'nature.com', keyword: 'science' },
    { site: 'science.org', keyword: 'science' },
    { site: 'newscientist.com', keyword: 'science' },
    { site: 'popsci.com', keyword: 'science' }
  ],
  'Health': [
    { site: 'webmd.com', keyword: 'health' },
    { site: 'health.harvard.edu', keyword: 'health' },
    { site: 'mayoclinic.org', keyword: 'health' },
    { site: 'nih.gov', keyword: 'health' },
    { site: 'medicalnewstoday.com', keyword: 'health' }
  ],
  'Travel': [
    { site: 'travelandleisure.com', keyword: 'travel' },
    { site: 'lonelyplanet.com', keyword: 'travel' },
    { site: 'tripadvisor.com', keyword: 'travel' },
    { site: 'nationalgeographic.com', keyword: 'travel' },
    { site: 'cntraveler.com', keyword: 'travel' }
  ],
  'Current News': [
    { site: 'reuters.com', keyword: 'news' },
    { site: 'apnews.com', keyword: 'news' },
    { site: 'bbc.com', keyword: 'news' },
    { site: 'npr.org', keyword: 'news' },
    { site: 'aljazeera.com', keyword: 'news' }
  ]
};

/**
 * Helper function to get search queries for a category
 * Prioritizes language-specific sources if available
 */
export function getSearchQueriesForCategory(category: string, language?: string): { site: string; keyword: string }[] {
  // Check if we have language-specific sources for this language and category
  if (language && 
      LANGUAGE_SPECIFIC_SOURCES[language] && 
      LANGUAGE_SPECIFIC_SOURCES[language][category]) {
    return LANGUAGE_SPECIFIC_SOURCES[language][category];
  }
  
  // For Chinese variants, try the general zh sources
  if (language && 
      (language.startsWith('zh') || language.includes('Hans') || language.includes('Hant')) && 
      LANGUAGE_SPECIFIC_SOURCES['zh'] && 
      LANGUAGE_SPECIFIC_SOURCES['zh'][category]) {
    return LANGUAGE_SPECIFIC_SOURCES['zh'][category];
  }

  // If no language-specific sources, use the default English sources
  return DEFAULT_CATEGORIES[category] || DEFAULT_CATEGORIES['Technology'];
}

/**
 * Default high-quality sources for the default view
 */
export const DEFAULT_SOURCES = [
  { site: 'techcrunch.com', keyword: 'tech' },
  { site: 'wired.com', keyword: 'technology' },
  { site: 'theverge.com', keyword: 'tech' },
  { site: 'venturebeat.com', keyword: 'artificial intelligence' },
  { site: 'technologyreview.mit.edu', keyword: 'AI' },
  { site: 'ai.googleblog.com', keyword: 'AI' }
];
