import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../ai/redis.service';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CAREER_PATHS = ['/careers', '/jobs', '/work-with-us', '/join-us', '/join', '/hiring'];
const CAREER_CHECK_TIMEOUT_MS = 2500;
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
    const cacheKey = `companies:nearby:v2:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;

    // Cache hit
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Fetch from Overpass
    const raw = await this.queryOverpass(lat, lng, radius);
    const enriched = await this.enrichWithCareerPages(raw);
    const results = enriched.slice(0, 25);

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
  node["amenity"="company"](around:${radius},${lat},${lng});
  node["building"="office"]["name"](around:${radius},${lat},${lng});
  node["name"~"software|technologies|tech|systems|solutions|it |digital|limited|ltd",i]["name"](around:${radius},${lat},${lng});
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
    // All companies concurrently — each career check is already bounded by timeout
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

    const checks = CAREER_PATHS.map(async (path) => {
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
        if (res.ok) return url;
        return null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    });

    const found = (await Promise.all(checks)).find((u) => u !== null) ?? null;
    return { found: found !== null, url: found };
  }

  private normalizeWebsite(url: string | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith('http')) return `https://${url}`;
    return url;
  }
}
