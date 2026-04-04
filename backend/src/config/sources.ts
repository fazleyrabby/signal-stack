export interface FeedSource {
  name: string;
  url: string;
  trustScore: number;
  category: 'geopolitics' | 'technology';
}

export const FEED_SOURCES: FeedSource[] = [
  // Geopolitics
  {
    name: 'Reuters World',
    url: 'https://feeds.reuters.com/reuters/worldNews',
    trustScore: 5,
    category: 'geopolitics',
  },
  {
    name: 'Reuters Tech',
    url: 'https://feeds.reuters.com/reuters/technologyNews',
    trustScore: 5,
    category: 'technology',
  },
  {
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    trustScore: 5,
    category: 'geopolitics',
  },
  {
    name: 'BBC Tech',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    trustScore: 5,
    category: 'technology',
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    trustScore: 4,
    category: 'geopolitics',
  },
  // Technology
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    trustScore: 4,
    category: 'technology',
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    trustScore: 3,
    category: 'technology',
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    trustScore: 3,
    category: 'technology',
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    trustScore: 4,
    category: 'technology',
  },
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    trustScore: 3,
    category: 'technology',
  },
];
