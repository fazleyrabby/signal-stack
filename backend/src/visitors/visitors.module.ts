import { Module } from '@nestjs/common';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';
import { VisitorsScheduler } from './visitors.scheduler';
import { GeoIPModule } from '../modules/geoip/geoip.module';

@Module({
  imports: [GeoIPModule],
  controllers: [VisitorsController],
  providers: [VisitorsService, VisitorsScheduler],
  exports: [VisitorsService],
})
export class VisitorsModule {}
