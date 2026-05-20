import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../ai/redis.service';
import { SettingsService } from '../ai/settings.service';

// Multiple Overpass instances — try in order on 504/timeout
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const MAPBOX_SEARCH_URL = 'https://api.mapbox.com/search/searchbox/v1';
const CACHE_TTL = 3600; // 1 hour

// Non-tech names to explicitly exclude (embassies, hospitals, schools, banks, etc.)
const NON_TECH_EXCLUDE = /\b(bank|banks|banking|finance|financial|insurance|leasing|hospital|clinic|pharmacy|pharma|restaurant|hotel|real estate|realty|property|construction|garments|textile|apparel|clothing|fashion|food|beverage|grocery|supermarket|retail|trade|import|export|transport|shipping|courier|airline|travel|tourism|newspaper|media|printing|school|college|university|madrasa|ngo|foundation|charity|government|ministry|embassy|consulate|diplomatic|church|mosque|temple|police|fire station|law firm|advocate|chamber of commerce|chamber|trading|enterprise|industries|mills|group of companies|agro|agri|poultry|fisheries|ceramics|cement|steel|iron|paint|furniture|decoration|hardware|stationery|tailoring|beauty|salon|spa|diagnostic|laboratory|pathology|dental|eye care|optical|flour|rice|oil|fuel|gas|petroleum|power|energy|solar|water|sanitation|security|guard|cleaning|laundry|packaging|printing|press|publisher|tv|radio|telecom operator|auto|automobile|car bike|vehicle|ticket|bus|rail|tax|gst|income tax|consultancy|advise|agent|agency|broker|dealer|showroom|stand|store|shop)\b/i;

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
  phone?: string | null;
  facebook?: string | null;
  email?: string | null;
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

    const cacheKey = `companies:nearby:v14:${source}:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    let results: NearbyCompany[] = [];
    let fetchError: string | null = null;

    try {
      if (source === 'google') {
        results = await this.findNearbyGoogle(lat, lng, radius);
      } else if (source === 'mapbox') {
        results = await this.findNearbyMapbox(lat, lng, radius);
      } else {
        const raw = await this.queryOverpass(lat, lng, radius);
        this.logger.log(`Overpass found ${raw.length} raw companies at ${lat},${lng} (radius ${radius}m)`);
        results = raw.filter((c) => isTechByOsm(c)).slice(0, 200);
      }
    } catch (err: any) {
      fetchError = err?.message || 'Unknown error';
      this.logger.error(`findNearby [${source}] failed: ${fetchError}`);
      return { data: [], error: fetchError } as any;
    }

    this.logger.log(`After tech filter: ${results.length} companies from ${source}`);

    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL);
    return results;
  }

  async suggestLocations(query: string): Promise<any[]> {
    if (!query || query.length < 3) return [];

    const cacheKey = `geo_suggest:${query.toLowerCase().trim()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const config = await this.settings.getModelConfig();
    let suggestions: any[] = [];

    try {
      if (config.mapboxEnabled) {
        const apiKey = await this.settings.getSetting('mapbox_api_key');
        if (apiKey) {
          const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&language=en&access_token=${apiKey}&session_token=signalstack_session&limit=5&types=place,locality`;
          const res = await fetch(url);
          const data = await res.json();
          
          suggestions = (data.suggestions || []).map((s: any) => ({
            label: s.full_address || s.name,
            name: s.name,
            mapbox_id: s.mapbox_id,
            provider: 'mapbox'
          }));
        }
      }

      if (suggestions.length === 0) {
        // OSM Fallback
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&featuretype=city`;
        const res = await fetch(url, { headers: { 'User-Agent': 'SignalStack/1.0' } });
        const data = await res.json();
        
        suggestions = data.map((item: any) => ({
          label: item.display_name,
          name: item.name || item.display_name.split(',')[0],
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          provider: 'osm'
        }));
      }

      // Cache for 24 hours
      if (suggestions.length > 0) {
        await this.redis.set(cacheKey, JSON.stringify(suggestions), 'EX', 86400);
      }
      return suggestions;
    } catch (error) {
      this.logger.error(`suggestLocations failed for "${query}": ${error.message}`);
      return [];
    }
  }

  async getMapboxDetails(mapboxId: string): Promise<{ lat: number; lng: number } | null> {
    const apiKey = await this.settings.getSetting('mapbox_api_key');
    if (!apiKey) return null;

    const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?access_token=${apiKey}&session_token=signalstack_session`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature?.geometry?.coordinates) {
        return {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`getMapboxDetails failed for ${mapboxId}: ${error.message}`);
      return null;
    }
  }

  private async findNearbyMapbox(lat: number, lng: number, radius: number): Promise<NearbyCompany[]> {
    const apiKey = await this.settings.getSetting('mapbox_api_key');
    if (!apiKey) {
      this.logger.warn('Mapbox API key not configured');
      return [];
    }

    // Build a bounding box from the radius to restrict results geographically.
    // Mapbox proximity only *biases* results — bbox enforces a hard boundary.
    const latDelta = radius / 111000; // 1 degree lat ≈ 111 km
    const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
    const bbox = `${(lng - lngDelta).toFixed(6)},${(lat - latDelta).toFixed(6)},${(lng + lngDelta).toFixed(6)},${(lat + latDelta).toFixed(6)}`;

    const categories = ['office', 'telecommunications', 'coworking_space', 'computer_and_electronics_store'];
    const seen = new Set<string>();
    const allResults: NearbyCompany[] = [];

    for (const category of categories) {
      // Try with bbox first, fallback to no bbox if 0 results
      let url = `${MAPBOX_SEARCH_URL}/category/${encodeURIComponent(category)}?proximity=${lng},${lat}&bbox=${bbox}&limit=25&access_token=${apiKey}`;
      let data: any;
      let res: any;

      try {
        res = await fetch(url);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          this.logger.error(`Mapbox HTTP ${res.status} for category "${category}": ${JSON.stringify(errBody)}`);
          continue;
        }

        data = await res.json();

        // Fallback 1: if no results with bbox, try without bbox (for sparse areas)
        if (!data.features?.length) {
          url = `${MAPBOX_SEARCH_URL}/category/${encodeURIComponent(category)}?proximity=${lng},${lat}&limit=25&access_token=${apiKey}`;
          this.logger.log(`Mapbox category "${category}" had 0 results with bbox, retrying without bbox`);
          res = await fetch(url);
          if (res.ok) {
            data = await res.json();
          }
        }

        // Fallback 2: try forward geocoding as last resort for sparse areas
        if (!data.features?.length) {
          const queries = ['tech company', 'software company', 'IT company', 'startup'];
          for (const q of queries) {
            url = `${MAPBOX_SEARCH_URL}/forward?q=${encodeURIComponent(q)}&proximity=${lng},${lat}&limit=10&access_token=${apiKey}`;
            const fgRes = await fetch(url);
            if (fgRes.ok) {
              const fgData = await fgRes.json();
              if (fgData.features?.length) {
                data = fgData;
                this.logger.log(`Mapbox category "${category}" falling back to forward geocoding "${q}" found ${fgData.features.length} results`);
                break;
              }
            }
          }
        }

        this.logger.log(`Mapbox category "${category}" found ${data.features?.length || 0} features near ${lng},${lat}`);

        for (const f of (data.features || [])) {
          const id = f.properties?.mapbox_id || f.id;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const featureLat = f.geometry?.coordinates?.[1] ?? lat;
          const featureLng = f.geometry?.coordinates?.[0] ?? lng;
          // Hard distance filter — discard anything outside the requested radius
          if (haversineMeters(lat, lng, featureLat, featureLng) > radius) continue;
          allResults.push({
            placeId: id,
            name: f.properties?.name || 'Unknown',
            website: f.properties?.metadata?.website || null,
            city: f.properties?.context?.place?.name || f.properties?.full_address || null,
            country: f.properties?.context?.country?.name || null,
            lat: featureLat,
            lng: featureLng,
            tags: f.properties?.categories || [],
            careerPageFound: false,
            careerUrl: null,
            phone: f.properties?.metadata?.phone || null,
            facebook: f.properties?.metadata?.facebook || null,
            email: f.properties?.metadata?.email || null,
          });
        }
      } catch (err) {
        this.logger.error(`Mapbox fetch failed for category "${category}": ${err}`);
      }
    }

    return allResults.filter(c => !NON_TECH_EXCLUDE.test(c.name));
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
          'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber',
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
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
        facebook: null,
        email: null,
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
      // Use forward text search for health check (category/software is not a valid Mapbox category)
      const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?q=tech+company&limit=1&proximity=90.41,23.81&access_token=${apiKey}`);
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

    // Try each mirror in order — skip to next on 429/504/timeout
    let res: Response | null = null;
    let lastError = '';
    for (const mirror of OVERPASS_MIRRORS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const attempt = await fetch(mirror, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SignalStack/1.0 (Contact: admin@signalstack.local)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (attempt.status === 504 || attempt.status === 429 || attempt.status === 503) {
          lastError = `Overpass mirror ${mirror} HTTP ${attempt.status}`;
          this.logger.warn(`${lastError} — trying next mirror`);
          continue;
        }
        res = attempt;
        this.logger.log(`Overpass success via ${mirror}`);
        break;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = `Overpass mirror ${mirror} failed: ${err.message}`;
        this.logger.warn(`${lastError} — trying next mirror`);
      }
    }

    if (!res) {
      throw new Error(`All Overpass mirrors failed. Last error: ${lastError}`);
    }

    try {
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

        // Contact info from OSM tags
        const phone = el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:mobile'] || null;
        const facebook = el.tags?.['contact:facebook'] || el.tags?.facebook || null;
        const email = el.tags?.email || el.tags?.['contact:email'] || null;

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
          phone,
          facebook,
          email,
        });
      }

      return companies;
    } catch (err) {
      throw err;
    }
  }

  private normalizeWebsite(url: string | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith('http')) return `https://${url}`;
    return url;
  }

  async checkHiringPage(website: string, companyName: string): Promise<{ found: boolean; url: string | null; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Try the main website first
      let res = await fetch(website, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SignalStack/1.0 (+https://signalstack.local)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      });
      clearTimeout(timeoutId);

      const html = await res.text();
      const lowerHtml = html.toLowerCase();

      // Search for hiring-related keywords
      const hiringPatterns = [
        /careers?\.(?:html?|php|asp|aspx|jsp)/i,
        /jobs?\.(?:html?|php|asp|aspx|jsp)/i,
        /join\s*(?:us|team)/i,
        /we(?:'re| are)\s*(?:hiring|looking\s*for)/i,
        /(?:hiring|open\s*positions|job\s*listings?)/i,
        /careers?\/(?!legal|privacy|about)/,
        /jobs\/(?!legal|privacy|about)/,
      ];

      // Common career page paths to try
      const careerPaths = ['/careers', '/jobs', '/career', '/join-us', '/work-with-us', '/openings'];

      // First check if current page has clear hiring indication
      for (const pattern of hiringPatterns) {
        if (pattern.test(html)) {
          return { found: true, url: website, message: 'Hiring page detected on website' };
        }
      }

      // Try common career subpaths
      const baseUrl = website.replace(/\/+$/, '');
      for (const path of careerPaths) {
        try {
          const checkUrl = baseUrl + path;
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 10000);
          const r = await fetch(checkUrl, {
            signal: c.signal,
            headers: { 'User-Agent': 'SignalStack/1.0' },
            redirect: 'follow',
          });
          clearTimeout(t);

          if (r.ok || r.status === 301 || r.status === 302) {
            const text = await r.text();
            // Confirm it's a hiring page
            if (/career|job|hiring|position|vacancy|opening/i.test(text)) {
              return { found: true, url: checkUrl, message: 'Career page found at ' + path };
            }
          }
        } catch {
          // continue to next path
        }
      }

      // Check for linkedIn, indeed, or other job boards
      const linkedinMatch = html.match(/(?:linkedin\.com\/company\/[^\s"'<>]+)/i);
      if (linkedinMatch) {
        return { found: true, url: linkedinMatch[0], message: 'LinkedIn company page (likely hiring)' };
      }

      // Check for common job board links
      if (/indeed\.com|glassdoor\.com|linkedin\.com\/jobs|bdjobs\.com|programmer|hotjobs\.yahoo/i.test(lowerHtml)) {
        return { found: true, url: website, message: 'Job board presence detected' };
      }

      return { found: false, url: null, message: 'No clear hiring page found' };
    } catch (err: any) {
      this.logger.error(`checkHiringPage for ${website}: ${err.message}`);
      return { found: false, url: null, message: 'Failed to check website: ' + err.message };
    }
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

  // No explicit tech tag — fall back to name-based heuristic.
  // OSM in South Asia is sparsely tagged; most tech companies only have office=yes.
  // Require at least a tech keyword in the name before passing through.
  const TECH_NAME_SIGNAL = /\b(tech|technology|technologies|software|digital|it\b|ict|cyber|data|cloud|ai\b|ml\b|web|app|dev|code|system|systems|solutions|network|networks|infra|infrastructure|telecom|telecommunications|erp|saas|fintech|edtech|healthtech|startup|innovation|lab|labs)\b/i;
  return TECH_NAME_SIGNAL.test(company.name);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
