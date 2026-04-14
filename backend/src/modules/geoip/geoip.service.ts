import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as maxmind from 'maxmind';
import { join } from 'path';
import { existsSync } from 'fs';

export interface GeoResult {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

@Injectable()
export class GeoIPService implements OnModuleInit {
  private readonly logger = new Logger(GeoIPService.name);
  private lookupReader: maxmind.Reader<maxmind.CityResponse> | null = null;
  private readonly dbPath = '/geoip/GeoLite2-City.mmdb';

  async onModuleInit() {
    try {
      if (existsSync(this.dbPath)) {
        this.lookupReader = await maxmind.open<maxmind.CityResponse>(this.dbPath);
        this.logger.log(`GeoLite2 DB loaded from ${this.dbPath}`);
      } else {
        this.logger.warn(`GeoLite2 DB not found at ${this.dbPath}. IP enrichment disabled.`);
      }
    } catch (err) {
      this.logger.error(`Failed to load GeoLite2 DB: ${err.message}`);
    }
  }

  lookup(ip: string): GeoResult | null {
    if (!this.lookupReader || !ip || ip === '127.0.0.1' || ip === '::1') {
      return null;
    }

    try {
      const result = this.lookupReader.get(ip);
      if (!result) return null;

      return {
        country: result.country?.names?.en || result.registered_country?.names?.en || null,
        city: result.city?.names?.en || null,
        latitude: result.location?.latitude || null,
        longitude: result.location?.longitude || null,
        timezone: result.location?.time_zone || null,
      };
    } catch (err) {
      // Fail silently as per requirements
      return null;
    }
  }
}
