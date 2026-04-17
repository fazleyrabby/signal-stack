import { Injectable, Logger } from '@nestjs/common';

const FETCH_TIMEOUT_MS = 8000;
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 3000;
const MAX_PAGES = 15;

// Rotate UA to reduce fingerprinting
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

export interface CrawledCompany {
  name: string;
  website: string | null;
  city: string | null;
  country: string;
  source: string;
  tags: string[];
}

export const CRAWLER_SOURCES = {
  basis: {
    label: 'BASIS',
    description: 'Bangladesh Association of Software & IT Services',
    country: 'Bangladesh',
    tags: ['software', 'IT'],
  },
  bacco: {
    label: 'BACCO',
    description: 'Bangladesh Association of Call Center & Outsourcing',
    country: 'Bangladesh',
    tags: ['BPO', 'outsourcing'],
  },
  bdjobs: {
    label: 'bdjobs',
    description: 'Bangladesh job board — unique hiring companies',
    country: 'Bangladesh',
    tags: [],
  },
} as const;

export type CrawlerSourceKey = keyof typeof CRAWLER_SOURCES;

@Injectable()
export class DirectoryCrawlerService {
  private readonly logger = new Logger(DirectoryCrawlerService.name);

  async crawl(source: CrawlerSourceKey): Promise<CrawledCompany[]> {
    this.logger.log(`Starting crawl: ${source}`);
    switch (source) {
      case 'basis':  return this.crawlBasis();
      case 'bacco':  return this.crawlBacco();
      case 'bdjobs': return this.crawlBdjobs();
    }
  }

  // ─── BASIS ────────────────────────────────────────────────────────────────
  private async crawlBasis(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://basis.org.bd/member-list?page=${page}`;
      const html = await this.fetchPage(url);
      if (!html) break;

      const companies = this.extractBasisCompanies(html);
      if (companies.length === 0) break;

      let anyNew = false;
      for (const c of companies) {
        const key = c.name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(c);
        anyNew = true;
      }
      if (!anyNew) break;

      this.logger.log(`BASIS page ${page}: found ${companies.length} companies (total ${results.length})`);
      if (page < MAX_PAGES) await this.randomDelay();
    }

    return results;
  }

  private extractBasisCompanies(html: string): CrawledCompany[] {
    const companies: CrawledCompany[] = [];

    // BASIS member list — company names appear in heading tags inside member cards
    // Pattern: extract text from h3/h4/h5 or strong near a website link
    const cardPattern = /<(?:h[2-5]|strong)[^>]*>([\s\S]{3,100}?)<\/(?:h[2-5]|strong)>/gi;
    const websitePattern = /href=["'](https?:\/\/[^"'\s>]+)["']/gi;

    // Extract all headings as candidate names
    const names: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = cardPattern.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 2 && text.length < 100 && !text.match(/^(menu|home|about|contact|login|search|next|prev)/i)) {
        names.push(text);
      }
    }

    // Extract all website links
    const websites: string[] = [];
    let wm: RegExpExecArray | null;
    while ((wm = websitePattern.exec(html)) !== null) {
      const href = wm[1];
      if (!href.includes('basis.org.bd') && !href.includes('facebook') && !href.includes('linkedin')) {
        websites.push(href);
      }
    }

    // Pair them up by index (approximate — works for card-grid layouts)
    for (let i = 0; i < names.length; i++) {
      companies.push({
        name: names[i],
        website: websites[i] || null,
        city: 'Dhaka',
        country: 'Bangladesh',
        source: 'basis',
        tags: ['software', 'IT'],
      });
    }

    return companies;
  }

  // ─── BACCO ────────────────────────────────────────────────────────────────
  private async crawlBacco(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1
        ? 'https://bacco.org.bd/member-directory'
        : `https://bacco.org.bd/member-directory?page=${page}`;

      const html = await this.fetchPage(url);
      if (!html) break;

      const companies = this.extractGenericMemberDirectory(html, 'bacco', ['BPO', 'outsourcing'], 'Bangladesh');
      if (companies.length === 0) break;

      let anyNew = false;
      for (const c of companies) {
        const key = c.name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(c);
        anyNew = true;
      }
      if (!anyNew) break;

      this.logger.log(`BACCO page ${page}: found ${companies.length} companies (total ${results.length})`);
      if (page < MAX_PAGES) await this.randomDelay();
    }

    return results;
  }

  // ─── bdjobs ───────────────────────────────────────────────────────────────
  private async crawlBdjobs(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://www.bdjobs.com/jobssearch/JobCategoryWise.asp?tp=1&pg=${page}`;
      const html = await this.fetchPage(url);
      if (!html) break;

      const companies = this.extractBdjobsCompanies(html);
      if (companies.length === 0) break;

      let anyNew = false;
      for (const c of companies) {
        const key = c.name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(c);
        anyNew = true;
      }
      if (!anyNew) break;

      this.logger.log(`bdjobs page ${page}: found ${companies.length} companies (total ${results.length})`);
      if (page < MAX_PAGES) await this.randomDelay();
    }

    return results;
  }

  private extractBdjobsCompanies(html: string): CrawledCompany[] {
    const companies: CrawledCompany[] = [];

    // bdjobs job listings — company names appear in links to company profile pages
    // Pattern: /jobs/jobsearch/JobCategoryWise.asp?compid=XXXXX or company name text in job cards
    const companyPattern = /companyName[^>]*>([^<]{3,100})<|<a[^>]+\/jobs\/[^>]+>([^<]{3,100})<\/a>/gi;

    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = companyPattern.exec(html)) !== null) {
      const name = (m[1] || m[2] || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      companies.push({
        name,
        website: null,
        city: null,
        country: 'Bangladesh',
        source: 'bdjobs',
        tags: [],
      });
    }

    return companies;
  }

  // ─── Generic member directory extractor ───────────────────────────────────
  private extractGenericMemberDirectory(
    html: string,
    source: string,
    tags: string[],
    country: string,
  ): CrawledCompany[] {
    const companies: CrawledCompany[] = [];

    // Find member card blocks — look for divs/articles with class containing "member" or "company"
    // Extract name from heading, website from href
    const blockPattern = /<(?:div|article|li|tr)[^>]*class="[^"]*(?:member|company|card|item|profile)[^"]*"[^>]*>([\s\S]{20,800}?)<\/(?:div|article|li|tr)>/gi;

    let block: RegExpExecArray | null;
    while ((block = blockPattern.exec(html)) !== null) {
      const content = block[1];

      // Name: first heading or strong
      const nameM = /<(?:h[2-6]|strong|b)[^>]*>([^<]{3,100})<\/(?:h[2-6]|strong|b)>/.exec(content);
      if (!nameM) continue;
      const name = nameM[1].trim();
      if (!name) continue;

      // Website: first external link in the block
      const linkM = /href=["'](https?:\/\/(?!(?:www\.)?(?:facebook|linkedin|twitter|bacco|basis)\.)[^"'\s>]+)["']/.exec(content);

      companies.push({
        name,
        website: linkM ? linkM[1] : null,
        city: null,
        country,
        source,
        tags,
      });
    }

    return companies;
  }

  // ─── HTTP helpers ──────────────────────────────────────────────────────────
  private async fetchPage(url: string): Promise<string | null> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
      });

      if (res.status === 429 || res.status === 503) {
        this.logger.warn(`Rate limited on ${url} (${res.status}) — stopping crawl`);
        return null;
      }
      if (!res.ok) {
        this.logger.warn(`HTTP ${res.status} on ${url}`);
        return null;
      }

      return await res.text();
    } catch (err) {
      this.logger.warn(`Fetch failed: ${url} — ${err}`);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private randomDelay(): Promise<void> {
    const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
