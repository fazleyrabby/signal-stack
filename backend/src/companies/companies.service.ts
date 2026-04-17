import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../ai/redis.service';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CAREER_PATHS = ['/careers', '/jobs', '/work-with-us', '/join-us', '/join', '/hiring', '/vacancies', '/opportunities', '/positions'];
const CAREER_CHECK_TIMEOUT_MS = 3000;
const HOMEPAGE_SCAN_TIMEOUT_MS = 4000;
const CACHE_TTL = 3600; // 1 hour
const MAX_CONCURRENT_REQUESTS = 8;

// Keywords that confirm a page is actually about jobs
const JOB_CONTENT_KEYWORDS = /\b(apply now|job opening|open position|current opening|career opportunit|we.re hiring|join our team|vacancies|job vacancies|full.time|part.time|internship|job listing|view all jobs|see all jobs|open roles|available position)\b/i;

// Links on homepage that suggest a careers section
const CAREER_LINK_PATTERN = /\b(career|careers|jobs|vacancies|hiring|openings|positions|join us|work with us|we.re hiring)\b/i;

export interface NearbyCompany {
  osmId: string;
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  tags: string[];
  careerPageFound: boolean;
  careerUrl: string | null;
}

// Simple semaphore to cap concurrent outbound HTTP requests
class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  private readonly semaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);

  constructor(private readonly redis: RedisService) {}

  async findNearby(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const cacheKey = `companies:nearby:v6:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    const raw = await this.queryOverpass(lat, lng, radius);
    this.logger.log(`Overpass found ${raw.length} raw companies at ${lat},${lng} (radius ${radius}m)`);
    
    const enriched = await this.enrichWithCareerPages(raw);
    const results = enriched.slice(0, 25);

    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL);
    return results;
  }

  private async queryOverpass(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const query = `
[out:json][timeout:30];
(
  node["office"~"company|tech|it|software|coworking|startup",i](around:${radius},${lat},${lng});
  way["office"~"company|tech|it|software|coworking|startup",i](around:${radius},${lat},${lng});
  node["office"="it"](around:${radius},${lat},${lng});
  way["office"="it"](around:${radius},${lat},${lng});
  node["craft"="software"](around:${radius},${lat},${lng});
  way["craft"="software"](around:${radius},${lat},${lng});
  node["amenity"="company"]["name"](around:${radius},${lat},${lng});
  node["name"~"software|technologies|tech|systems|solutions|digital",i](around:${radius},${lat},${lng});
);
out center;
    `.trim();

    this.logger.log(`Querying Overpass: around ${radius}m of ${lat},${lng}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 29000);

    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SignalStack/1.0 (Contact: admin@signalstack.local)'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'no body');
        this.logger.error(`Overpass HTTP ${res.status}: ${errText}`);
        throw new Error(`Overpass HTTP ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.elements) {
        this.logger.warn(`Overpass returned no elements array for ${lat},${lng}`);
        return [];
      }

      const seen = new Set<string>();
      const companies: NearbyCompany[] = [];

      for (const el of data.elements) {
        const name = el.tags?.name;
        if (!name) continue;

        const key = name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);

        const website = this.normalizeWebsite(el.tags?.website || el.tags?.url);
        const tags: string[] = [];
        if (el.tags?.office) tags.push(el.tags.office);
        if (el.tags?.craft) tags.push(el.tags.craft);
        if (el.tags?.['company:type']) tags.push(el.tags['company:type']);
        if (el.tags?.sector) tags.push(el.tags.sector);

        // nodes have el.lat/el.lon; ways have el.center.lat/el.center.lon
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (!elLat || !elLng) continue;

        companies.push({
          osmId: String(el.id),
          name,
          website,
          city: el.tags?.['addr:city'] || el.tags?.['addr:town'] || null,
          country: el.tags?.['addr:country'] || null,
          lat: elLat,
          lng: elLng,
          tags,
          careerPageFound: false,
          careerUrl: null,
        });
      }

      return companies;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async enrichWithCareerPages(companies: NearbyCompany[]): Promise<NearbyCompany[]> {
    const results = [...companies];
    await Promise.all(
      results.map(async (company) => {
        if (!company.website) return;
        const result = await this.checkCareerPage(company.website);
        company.careerPageFound = result.found;
        company.careerUrl = result.url;
      }),
    );
    return results;
  }

  private async checkCareerPage(website: string): Promise<{ found: boolean; url: string | null }> {
    const base = website.replace(/\/$/, '');

    // Step 1: HEAD all known paths concurrently (fast, low bandwidth)
    const headResults = await Promise.all(
      CAREER_PATHS.map((path) => this.headRequest(`${base}${path}`)),
    );
    const candidates = headResults.filter((u): u is string => u !== null);

    // Step 2: GET each candidate and verify it has real job content
    for (const url of candidates) {
      const confirmed = await this.verifyJobContent(url);
      if (confirmed) return { found: true, url };
    }

    // Step 3: Fallback — scan homepage for career links
    const homepageCareerUrl = await this.scanHomepageForCareerLink(base);
    if (homepageCareerUrl) return { found: true, url: homepageCareerUrl };

    return { found: false, url: null };
  }

  private async headRequest(url: string): Promise<string | null> {
    await this.semaphore.acquire();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CAREER_CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'SignalStack/1.0' },
      });
      return res.ok ? url : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      this.semaphore.release();
    }
  }

  private async verifyJobContent(url: string): Promise<boolean> {
    await this.semaphore.acquire();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CAREER_CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'SignalStack/1.0' },
      });
      if (!res.ok) return false;
      // Read only first 30KB — enough for any above-fold job content
      const reader = res.body?.getReader();
      if (!reader) return false;
      let text = '';
      let bytes = 0;
      while (bytes < 30_000) {
        const { done, value } = await reader.read();
        if (done) break;
        text += new TextDecoder().decode(value);
        bytes += value.byteLength;
      }
      reader.cancel();
      return JOB_CONTENT_KEYWORDS.test(text);
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
      this.semaphore.release();
    }
  }

  private async scanHomepageForCareerLink(base: string): Promise<string | null> {
    await this.semaphore.acquire();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HOMEPAGE_SCAN_TIMEOUT_MS);
    try {
      const res = await fetch(base, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'SignalStack/1.0' },
      });
      if (!res.ok) return null;

      const reader = res.body?.getReader();
      if (!reader) return null;
      let html = '';
      let bytes = 0;
      while (bytes < 50_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
        bytes += value.byteLength;
      }
      reader.cancel();

      // Safe linear scan — no backtracking regex on untrusted HTML
      let pos = 0;
      while (pos < html.length) {
        const aStart = html.indexOf('<a ', pos);
        if (aStart === -1) break;
        const tagEnd = html.indexOf('>', aStart);
        if (tagEnd === -1) break;
        const tag = html.slice(aStart, tagEnd + 1);

        const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
        if (hrefMatch) {
          const href = hrefMatch[1];
          const closeA = html.indexOf('</a>', tagEnd);
          const innerText = closeA !== -1
            ? html.slice(tagEnd + 1, closeA).replace(/<[^>]+>/g, '').trim()
            : '';

          if (CAREER_LINK_PATTERN.test(href) || CAREER_LINK_PATTERN.test(innerText)) {
            if (href.startsWith('http')) return href;
            if (href.startsWith('/')) return `${base}${href}`;
          }
        }
        pos = tagEnd + 1;
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      this.semaphore.release();
    }
  }

  private normalizeWebsite(url: string | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith('http')) return `https://${url}`;
    return url;
  }
}
