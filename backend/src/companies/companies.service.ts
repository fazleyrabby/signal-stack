import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../ai/redis.service';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL = 3600; // 1 hour

// Non-tech names to explicitly exclude (embassies, hospitals, schools, banks, etc.)
const NON_TECH_EXCLUDE = /\b(bank|banks|banking|finance|financial|insurance|leasing|hospital|clinic|pharmacy|pharma|restaurant|hotel|real estate|realty|property|construction|garments|textile|apparel|food|beverage|grocery|supermarket|retail|trade|import|export|transport|shipping|airline|travel|tourism|newspaper|school|college|university|ngo|foundation|charity|government|ministry|embassy|consulate|diplomatic|church|mosque|temple|police|fire station)\b/i;

// OSM office type tags that are definitely not tech
const NON_TECH_OFFICE_TAGS = new Set(['diplomatic', 'government', 'educational_institution', 'association', 'ngo', 'religion', 'lawyer', 'accountant', 'notary', 'financial', 'insurance', 'estate_agent']);

// Tech-positive office tags
const TECH_OFFICE_TAGS = new Set(['it', 'tech', 'software', 'coworking', 'startup', 'company', 'yes']);

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
    const cacheKey = `companies:nearby:v7:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    const raw = await this.queryOverpass(lat, lng, radius);
    this.logger.log(`Overpass found ${raw.length} raw companies at ${lat},${lng} (radius ${radius}m)`);

    // Filter out clearly non-tech (embassies, hospitals, banks) — keep everything else
    const results = raw.filter((c) => isTechByOsm(c)).slice(0, 100);
    this.logger.log(`After tech filter: ${results.length} companies`);

    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL);
    return results;
  }

  private async queryOverpass(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    // Broad query: fetch ALL offices/companies within radius regardless of type tag.
    // We filter to tech companies in JS after — OSM tagging in South Asia is inconsistent,
    // so relying on office=tech/software misses most real companies.
    const query = `
[out:json][timeout:30];
(
  node["office"](around:${radius},${lat},${lng});
  way["office"](around:${radius},${lat},${lng});
  node["office"="company"](around:${radius},${lat},${lng});
  way["office"="company"](around:${radius},${lat},${lng});
  node["building"="office"]["name"](around:${radius},${lat},${lng});
  way["building"="office"]["name"](around:${radius},${lat},${lng});
  node["amenity"="office"]["name"](around:${radius},${lat},${lng});
  node["name"~"software|tech|technology|digital|IT|solutions|systems|apps|web|mobile|cloud|fintech|ecommerce|startup|dev|platform|SaaS|AI|ERP|CRM|automation|computing|internet|studio|lab|innovation|byte|pixel|logic|nexus|neural|algorithm",i](around:${radius},${lat},${lng});
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
          'User-Agent': 'SignalStack/1.0 (Contact: admin@signalstack.local)',
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
        this.logger.warn(`Overpass returned no elements for ${lat},${lng}`);
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

  private normalizeWebsite(url: string | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith('http')) return `https://${url}`;
    return url;
  }
}

function isTechByOsm(company: NearbyCompany): boolean {
  const name = company.name;

  // Always exclude clearly non-tech by name (embassies, hospitals, banks, etc.)
  if (NON_TECH_EXCLUDE.test(name)) return false;

  // Exclude by OSM office tag if it's a known non-tech type
  for (const tag of company.tags) {
    if (NON_TECH_OFFICE_TAGS.has(tag.toLowerCase())) return false;
  }

  // Keep if has tech office tag
  for (const tag of company.tags) {
    if (TECH_OFFICE_TAGS.has(tag.toLowerCase())) return true;
  }

  // Keep anything else that has an office tag with a name but no non-tech signal.
  // OSM coverage in South Asia is sparse — most tech companies only have office=yes
  // with no further categorisation. Showing them is better than showing nothing.
  return true;
}
