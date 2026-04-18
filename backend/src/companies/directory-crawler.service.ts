import { Injectable, Logger } from '@nestjs/common';

const FETCH_TIMEOUT_MS = 20000;
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 3000;
const MAX_PAGES = 15;

const LOCATION_KEYWORDS = {
  Chittagong: /\b(chittagong|ctg|chatogram|pahartali|halishahar|panchlaish|double mooring|patenga|agrabad|nasirabad|khulshi)\b/i,
  Sylhet: /\b(sylhet)\b/i,
  Rajshahi: /\b(rajshahi)\b/i,
  Khulna: /\b(khulna)\b/i,
};

function detectCity(name: string, defaultCity: string | null = 'Dhaka'): string | null {
  for (const [city, regex] of Object.entries(LOCATION_KEYWORDS)) {
    if (regex.test(name)) return city;
  }
  return defaultCity;
}

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
  ecab: {
    label: 'e-CAB',
    description: 'e-Commerce Association of Bangladesh',
    country: 'Bangladesh',
    tags: ['ecommerce', 'fintech', 'logistics'],
  },
  github_bd: {
    label: 'GitHub Tech List',
    description: 'Community-curated list of BD tech companies',
    country: 'Bangladesh',
    tags: ['startup', 'software', 'tech'],
  },
} as const;

export type CrawlerSourceKey = keyof typeof CRAWLER_SOURCES;

@Injectable()
export class DirectoryCrawlerService {
  private readonly logger = new Logger(DirectoryCrawlerService.name);

  async crawl(source: CrawlerSourceKey): Promise<CrawledCompany[]> {
    this.logger.log(`Starting crawl: ${source}`);
    switch (source) {
      case 'basis':     return this.crawlBasis();
      case 'bacco':     return this.crawlBacco();
      case 'bdjobs':    return this.crawlBdjobs();
      case 'ecab':      return this.crawlEcab();
      case 'github_bd': return this.crawlGithubBd();
    }
  }

  // ─── BASIS ────────────────────────────────────────────────────────────────
  // Uses JSON API: GET https://basis.org.bd/get-member-list?page=N
  // Response: { data: [{company_name, membership_no, ...}], meta: {last_page, total} }
  private async crawlBasis(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://basis.org.bd/get-member-list?page=${page}`;
      const json = await this.fetchJson(url, {
        'Accept': 'application/json',
        'Referer': 'https://basis.org.bd/member-list',
      });
      if (!json) break;

      const items: any[] = json.data ?? [];
      if (items.length === 0) break;

      let anyNew = false;
      for (const item of items) {
        const name = (item.company_name ?? '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          name,
          website: null, // profile fetch is 2806 requests — skip to stay safe
          city: detectCity(name, 'Dhaka'),
          country: 'Bangladesh',
          source: 'basis',
          tags: ['software', 'IT'],
        });
        anyNew = true;
      }
      if (!anyNew) break;

      const lastPage: number = json.meta?.last_page ?? page;
      this.logger.log(`BASIS page ${page}/${lastPage}: +${items.length} (total ${results.length})`);
      if (page >= lastPage || page >= MAX_PAGES) break;
      await this.randomDelay();
    }

    return results;
  }

  // ─── BACCO ────────────────────────────────────────────────────────────────
  // Server-rendered: GET https://bacco.org.bd/member-list?page=N
  // Each member block:
  //   <div class="media mt-5 member-list-img">
  //     <h5 class="mt-0">COMPANY NAME</h5>
  //     <a href="https:////www.site.com">www.site.com</a>
  //   </div>
  private async crawlBacco(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://bacco.org.bd/member-list?page=${page}`;
      const html = await this.fetchPage(url);
      if (!html) break;

      const companies = this.extractBaccoCompanies(html);
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

      this.logger.log(`BACCO page ${page}: +${companies.length} (total ${results.length})`);
      if (page < MAX_PAGES) await this.randomDelay();
    }

    return results;
  }

  private extractBaccoCompanies(html: string): CrawledCompany[] {
    const companies: CrawledCompany[] = [];
    const BLOCK_MARKER = 'media mt-5 member-list-img';

    let pos = 0;
    while (true) {
      const blockStart = html.indexOf(BLOCK_MARKER, pos);
      if (blockStart === -1) break;

      // Find the closing </div> for this block (~500 chars is plenty)
      const blockEnd = html.indexOf('</div>', blockStart + BLOCK_MARKER.length);
      if (blockEnd === -1) break;
      const block = html.slice(blockStart, blockEnd + 6);
      pos = blockEnd + 6;

      // Extract name from <h5 class="mt-0">NAME</h5>
      const h5Start = block.indexOf('<h5');
      const h5Close = block.indexOf('>', h5Start);
      const h5End = block.indexOf('</h5>', h5Close);
      if (h5Start === -1 || h5Close === -1 || h5End === -1) continue;
      const name = block.slice(h5Close + 1, h5End).trim();
      if (!name || name.length < 2) continue;

      // Extract website from <a href="..."> — fix BACCO's double-slash bug "https:////www."
      let website: string | null = null;
      const aStart = block.indexOf('<a ', h5End);
      if (aStart !== -1) {
        const hrefIdx = block.indexOf('href=', aStart);
        if (hrefIdx !== -1) {
          const quote = block[hrefIdx + 5];
          if (quote === '"' || quote === "'") {
            const hrefEnd = block.indexOf(quote, hrefIdx + 6);
            if (hrefEnd !== -1) {
              let href = block.slice(hrefIdx + 6, hrefEnd).trim();
              // Fix "https:////www." → "https://www."
              href = href.replace(/^(https?:)\/\/+/, '$1//');
              if (href.startsWith('http') && !href.includes('bacco.org.bd')) {
                website = href;
              }
            }
          }
        }
      }

      companies.push({
        name,
        website,
        city: detectCity(name, null),
        country: 'Bangladesh',
        source: 'bacco',
        tags: ['BPO', 'outsourcing'],
      });
    }

    return companies;
  }

  // ─── bdjobs ───────────────────────────────────────────────────────────────
  // Server-rendered: GET https://jobs.bdjobs.com/Company_list.asp
  // Structure:
  //   <div class="Org-name">
  //     <a class="sub_window_new_update" data-path='companyofferedjobs.asp?id=24362&...' href="javascript:void(0);">
  //       Company Name
  //     </a>
  //   </div>
  // Single page — all companies listed without pagination
  private async crawlBdjobs(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    const url = 'https://jobs.bdjobs.com/Company_list.asp';
    const html = await this.fetchPage(url);
    if (!html) return results;

    const companies = this.extractBdjobsCompanies(html);
    for (const c of companies) {
      const key = c.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(c);
    }

    this.logger.log(`bdjobs: found ${results.length} companies`);
    return results;
  }

  private static readonly BDJOBS_EXCLUDE = /\b(bank|banks|banking|finance|financial|insurance|leasing|brac bank|dutch.bangla|islami bank|trust bank|city bank|mutual trust)\b/i;

  private extractBdjobsCompanies(html: string): CrawledCompany[] {
    const companies: CrawledCompany[] = [];
    const BLOCK_MARKER = 'class="Org-name"';

    let pos = 0;
    while (true) {
      const blockStart = html.indexOf(BLOCK_MARKER, pos);
      if (blockStart === -1) break;

      // Find closing </div>
      const divEnd = html.indexOf('</div>', blockStart + BLOCK_MARKER.length);
      if (divEnd === -1) break;
      const block = html.slice(blockStart, divEnd + 6);
      pos = divEnd + 6;

      // Find inner <a> tag and extract text
      const aStart = block.indexOf('<a ');
      if (aStart === -1) continue;
      const aClose = block.indexOf('>', aStart);
      const aEnd = block.indexOf('</a>', aClose);
      if (aClose === -1 || aEnd === -1) continue;

      const name = block.slice(aClose + 1, aEnd).replace(/&amp;/g, '&').trim();
      if (!name || name.length < 2) continue;
      if (DirectoryCrawlerService.BDJOBS_EXCLUDE.test(name)) continue;

      companies.push({
        name,
        website: null,
        city: detectCity(name, null),
        country: 'Bangladesh',
        source: 'bdjobs',
        tags: [],
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

  private async fetchJson(url: string, extraHeaders: Record<string, string> = {}): Promise<any | null> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': ua,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          ...extraHeaders,
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

      return await res.json();
    } catch (err) {
      this.logger.warn(`Fetch/parse failed: ${url} — ${err}`);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── e-CAB ────────────────────────────────────────────────────────────────
  // Server-rendered: GET https://e-cab.net/member-list?page=N
  // Structure: <h5><a href="...">COMPANY NAME</a></h5> or similar heading
  private async crawlEcab(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= 10; page++) {
      const url = `https://e-cab.net/member-list?page=${page}`;
      const html = await this.fetchPage(url);
      if (!html) break;

      let pos = 0;
      let count = 0;
      while (true) {
        // Look for any link that might be a member name
        const aStart = html.indexOf('<a ', pos);
        if (aStart === -1) break;
        const aClose = html.indexOf('>', aStart);
        if (aClose === -1) { pos = aStart + 3; continue; }
        
        const aEnd = html.indexOf('</a>', aClose);
        if (aEnd === -1) { pos = aClose + 1; continue; }

        const name = html.slice(aClose + 1, aEnd).replace(/<[^>]+>/g, '').trim();
        pos = aEnd + 4;

        // e-CAB specific: members are usually inside headings or have specific classes
        // but we can filter by length and common words
        if (name.length < 3 || name.length > 100) continue;
        if (/^(home|about|contact|login|register|member|policy|terms|join|apply)/i.test(name)) continue;

        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          name,
          website: null,
          city: detectCity(name, null),
          country: 'Bangladesh',
          source: 'ecab',
          tags: ['ecommerce', 'fintech'],
        });
        count++;
      }
      this.logger.log(`e-CAB page ${page}: found ${count} candidates`);
      if (count === 0) break;
      await this.randomDelay();
    }
    return results;
  }

  // ─── GitHub BD Tech List ──────────────────────────────────────────────────
  // Markdown: [Company Name](http://website.com) - Location
  private async crawlGithubBd(): Promise<CrawledCompany[]> {
    const results: CrawledCompany[] = [];
    const url = 'https://raw.githubusercontent.com/MBSTUPC/tech-companies-in-bangladesh/master/README.md';
    const md = await this.fetchPage(url);
    if (!md) return results;

    const lines = md.split('\n');
    for (const line of lines) {
      // Pattern: [Name](URL) - Description/Location
      const match = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)(.*)/.exec(line);
      if (match) {
        const name = match[1].trim();
        const website = match[2].trim();
        const desc = match[3].trim();

        if (name.toLowerCase().includes('company name')) continue;

        results.push({
          name,
          website,
          city: detectCity(name + ' ' + desc, null),
          country: 'Bangladesh',
          source: 'github_bd',
          tags: ['tech', 'software'],
        });
      }
    }
    this.logger.log(`GitHub Tech List: found ${results.length} companies`);
    return results;
  }

  private randomDelay(): Promise<void> {
    const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
