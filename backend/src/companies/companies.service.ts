import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../ai/redis.service';
import { SettingsService } from '../ai/settings.service';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const MAPBOX_SEARCH_URL = 'https://api.mapbox.com/search/searchbox/v1/category/software';
const CACHE_TTL = 3600; // 1 hour

// Non-tech names to explicitly exclude (embassies, hospitals, schools, banks, etc.)
const NON_TECH_EXCLUDE = /\b(bank|banks|banking|finance|financial|insurance|leasing|hospital|clinic|pharmacy|pharma|restaurant|hotel|real estate|realty|property|construction|garments|textile|apparel|food|beverage|grocery|supermarket|retail|trade|import|export|transport|shipping|airline|travel|tourism|newspaper|school|college|university|ngo|foundation|charity|government|ministry|embassy|consulate|diplomatic|church|mosque|temple|police|fire station)\b/i;

// OSM office type tags that are definitely not tech
const NON_TECH_OFFICE_TAGS = new Set(['diplomatic', 'government', 'educational_institution', 'association', 'ngo', 'religion', 'lawyer', 'accountant', 'notary', 'financial', 'insurance', 'estate_agent']);

// Tech-positive office tags
const TECH_OFFICE_TAGS = new Set(['it', 'tech', 'software', 'coworking', 'startup', 'company', 'yes']);

export interface NearbyCompany {
  osmId?: string;
  placeId?: string;
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

  constructor(
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  async findNearby(lat: number, lng: number, radius: number, source: 'osm' | 'google' | 'mapbox' = 'osm'): Promise<NearbyCompany[]> {
    const config = await this.settings.getModelConfig();

    if (source === 'osm' && !config.osmEnabled) return [];
    if (source === 'google' && !config.googlePlacesEnabled) return [];
    if (source === 'mapbox' && !config.mapboxEnabled) return [];

    const cacheKey = `companies:nearby:v11:${source}:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    let results: NearbyCompany[] = [];

    if (source === 'google') {
      results = await this.findNearbyGoogle(lat, lng, radius);
    } else if (source === 'mapbox') {
      results = await this.findNearbyMapbox(lat, lng, radius);
    } else {
      const raw = await this.queryOverpass(lat, lng, radius);
      this.logger.log(`Overpass found ${raw.length} raw companies at ${lat},${lng} (radius ${radius}m)`);
      results = raw.filter((c) => isTechByOsm(c)).slice(0, 200);
    }

    this.logger.log(`After tech filter: ${results.length} companies from ${source}`);

    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL);
    return results;
  }

  private async findNearbyMapbox(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const apiKey = await this.settings.getSetting('mapbox_api_key');
    if (!apiKey) {
      this.logger.warn('Mapbox API key not configured');
      return [];
    }

    // Mapbox Category Search: Category "software" or "tech"
    // Radius is not directly supported in Category Search, we use proximity
    const url = `${MAPBOX_SEARCH_URL}?proximity=${lng},${lat}&access_token=${apiKey}&limit=25`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.error(`Mapbox HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      this.logger.log(`Mapbox found ${data.features?.length || 0} features for proximity ${lng},${lat}`);
      const results: NearbyCompany[] = (data.features || []).map((f: any) => ({
        placeId: f.properties.mapbox_id,
        name: f.properties.name,
        website: f.properties.metadata?.website || null,
        city: f.properties.context?.place?.name || f.properties.full_address || null,
        country: f.properties.context?.country?.name || 'Bangladesh',
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        tags: f.properties.categories || [],
        careerPageFound: false,
        careerUrl: null,
      }));

      return results.filter(c => !NON_TECH_EXCLUDE.test(c.name));
    } catch (err) {
      this.logger.error(`Mapbox fetch failed: ${err}`);
      return [];
    }
  }

  private async findNearbyGoogle(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const apiKey = await this.settings.getSetting('google_places_api_key');
    if (!apiKey) {
      this.logger.warn('Google Places API key not configured');
      return [];
    }

    try {
      const res = await fetch(GOOGLE_PLACES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,places.location,places.types',
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radius,
            },
          },
          includedTypes: ['establishment'],
          maxResultCount: 20,
        }),
      });

      if (!res.ok) {
        this.logger.error(`Google Places New HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      const results: NearbyCompany[] = (data.places || []).map((p: any) => ({
        placeId: p.id,
        name: p.displayName?.text || 'Unknown',
        website: p.websiteUri || null,
        city: p.formattedAddress || null,
        country: 'Bangladesh',
        lat: p.location.latitude,
        lng: p.location.longitude,
        tags: p.types || [],
        careerPageFound: false,
        careerUrl: null,
      }));

      return results.filter(c => !NON_TECH_EXCLUDE.test(c.name));
    } catch (err) {
      this.logger.error(`Google Places New fetch failed: ${err}`);
      return [];
    }
  }

  async checkMapboxHealth(): Promise<{ status: string; error?: string }> {
    const apiKey = await this.settings.getSetting('mapbox_api_key');
    if (!apiKey) return { status: 'no_api_key' };

    try {
      // Mapbox V1 requires proximity or other location context
      const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/category/software?limit=1&proximity=90.41,23.81&access_token=${apiKey}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { status: 'error', error: data.message || `HTTP ${res.status}` };
      }
      return { status: 'healthy' };
    } catch (err: any) {
      return { status: 'error', error: err.message };
    }
  }

  async checkGoogleHealth(): Promise<{ status: string; error?: string }> {
    const apiKey = await this.settings.getSetting('google_places_api_key');
    if (!apiKey) return { status: 'no_api_key' };

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({
          locationRestriction: { circle: { center: { latitude: 23.8, longitude: 90.4 }, radius: 100 } },
          includedTypes: ['establishment'],
          maxResultCount: 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { status: 'error', error: data.error?.message || `HTTP ${res.status}` };
      }
      return { status: 'healthy' };
    } catch (err: any) {
      return { status: 'error', error: err.message };
    }
  }

  private async queryOverpass(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    // Simple union: any office-tagged node or way within radius.
    // Name-regex clauses were causing 504 timeouts on Overpass for large radii.
    // JS-side isTechByOsm() does the tech/non-tech filtering after.
    const safeRadius = Math.min(radius, 20000); // cap at 20km to avoid Overpass timeouts
    const query = `
[out:json][timeout:30];
(
  node["office"](around:${safeRadius},${lat},${lng});
  way["office"](around:${safeRadius},${lat},${lng});
  node["amenity"="company"](around:${safeRadius},${lat},${lng});
  way["amenity"="company"](around:${safeRadius},${lat},${lng});
  node["company"](around:${safeRadius},${lat},${lng});
  way["company"](around:${safeRadius},${lat},${lng});
  node["name"]["building"="commercial"](around:${safeRadius},${lat},${lng});
  way["name"]["building"="commercial"](around:${safeRadius},${lat},${lng});
);
out center;
    `.trim();

    this.logger.log(`Querying Overpass: around ${radius}m of ${lat},${lng}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

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
