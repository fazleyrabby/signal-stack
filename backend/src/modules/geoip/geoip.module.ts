import { Module } from '@nestjs/common';
import { GeoIPService } from './geoip.service';

@Module({
  providers: [GeoIPService],
  exports: [GeoIPService],
})
export class GeoIPModule {}
