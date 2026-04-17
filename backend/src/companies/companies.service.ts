import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../ai/redis.service';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CAREER_PATHS = ['/careers', '/jobs', '/work-with-us', '/join-us', '/join', '/hiring'];
const CAREER_CHECK_TIMEOUT_MS = 4000;
const CACHE_TTL = 3600; // 1 hour

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

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly redis: RedisService) {}

  async findNearby(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const cacheKey = `companies:nearby:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;

    // Cache hit
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Fetch from Overpass
    const raw = await this.queryOverpass(lat, lng, radius);
    const enriched = await this.enrichWithCareerPages(raw);
    const results = enriched.slice(0, 15);

    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL);
    return results;
  }

  private async queryOverpass(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const query = `
[out:json][timeout:25];
(
  node["office"~"company|tech|it|software|coworking|startup",i](around:${radius},${lat},${lng});
  node["name"]["website"]["office"](around:${radius},${lat},${lng});
  node["name"]["website"]["company"](around:${radius},${lat},${lng});
);
out body;
    `.trim();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const data = await res.json();

      const seen = new Set<string>();
      const companies: NearbyCompany[] = [];

      for (const el of data.elements || []) {
        const name = el.tags?.name;
        if (!name) continue;

        // Deduplicate by name
        const key = name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);

        const website = this.normalizeWebsite(el.tags?.website || el.tags?.url);
        const tags: string[] = [];
        if (el.tags?.office) tags.push(el.tags.office);
        if (el.tags?.['company:type']) tags.push(el.tags['company:type']);
        if (el.tags?.sector) tags.push(el.tags.sector);

        companies.push({
          osmId: String(el.id),
          name,
          website,
          city: el.tags?.['addr:city'] || el.tags?.['addr:town'] || null,
          country: el.tags?.['addr:country'] || null,
          lat: el.lat,
          lng: el.lon,
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
    // Process in batches of 5 concurrently
    const batchSize = 5;
    const results = [...companies];

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (company) => {
          if (!company.website) return;
          const result = await this.checkCareerPage(company.website);
          company.careerPageFound = result.found;
          company.careerUrl = result.url;
        }),
      );
    }

    return results;
  }

  private async checkCareerPage(website: string): Promise<{ found: boolean; url: string | null }> {
    const base = website.replace(/\/$/, '');

    for (const path of CAREER_PATHS) {
      const url = `${base}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CAREER_CHECK_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'SignalStack/1.0' },
        });

        if (res.ok) {
          return { found: true, url };
        }
      } catch {
        // timeout or network error — try next path
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return { found: false, url: null };
  }

  private normalizeWebsite(url: string | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith('http')) return `https://${url}`;
    return url;
  }
}
