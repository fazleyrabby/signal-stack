import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from './companies.repository';
import { DirectoryCrawlerService, CRAWLER_SOURCES, CrawlerSourceKey } from './directory-crawler.service';
import { isTechCompany } from './companies.repository';
import { SkipThrottle } from '@nestjs/throttler';
import { SettingsService } from '../ai/settings.service';

@Controller('api/admin/companies')
@UseGuards(AdminGuard)
@SkipThrottle()
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companiesRepository: CompaniesRepository,
    private readonly crawlerService: DirectoryCrawlerService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('radar/sources')
  async getRadarSources() {
    const config = await this.settingsService.getModelConfig();
    return {
      osm: { enabled: config.osmEnabled },
      google: { enabled: config.googlePlacesEnabled },
      mapbox: { enabled: config.mapboxEnabled },
      translationThreshold: config.translationThreshold,
      forceAllTranslations: config.forceAllTranslations,
    };
  }

  @Put('radar/settings')
  async updateRadarSettings(
    @Body() body: { translationThreshold?: number; forceAllTranslations?: boolean },
  ) {
    await this.settingsService.setModelConfig(body);
    return { success: true };
  }

  @Put('radar/sources')
  async updateRadarSource(
    @Body() body: { source: 'osm' | 'google' | 'mapbox'; enabled: boolean },
  ) {
    const { source, enabled } = body;
    if (source === 'osm') {
      await this.settingsService.setModelConfig({ osmEnabled: enabled });
    } else if (source === 'google') {
      await this.settingsService.setModelConfig({ googlePlacesEnabled: enabled });
    } else if (source === 'mapbox') {
      await this.settingsService.setModelConfig({ mapboxEnabled: enabled });
    }
    return { success: true };
  }

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string = '10000',
    @Query('source') source: 'osm' | 'google' | 'mapbox' = 'osm',
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseInt(radius, 10);

    if (isNaN(latNum) || isNaN(lngNum)) {
      throw new BadRequestException('lat and lng are required');
    }

    const result = await this.companiesService.findNearby(latNum, lngNum, radiusNum, source);
    // findNearby returns NearbyCompany[] normally, or { data: [], error: string } on fetch failure
    if (Array.isArray(result)) {
      return { data: result, total: result.length };
    }
    return result;
  }

  @Get('geocoding/suggest')
  async suggest(@Query('q') q: string) {
    return this.companiesService.suggestLocations(q);
  }

  @Get('geocoding/retrieve')
  async retrieve(@Query('id') id: string) {
    const details = await this.companiesService.getMapboxDetails(id);
    if (!details) throw new BadRequestException('Failed to retrieve location details');
    return details;
  }

  @Get('crawl/sources')
  getCrawlSources() {
    return CRAWLER_SOURCES;
  }

  @Post('crawl')
  async runCrawl(@Body('source') source: string) {
    if (!source || !(source in CRAWLER_SOURCES)) {
      throw new BadRequestException(`Invalid source. Valid: ${Object.keys(CRAWLER_SOURCES).join(', ')}`);
    }
    const companies = await this.crawlerService.crawl(source as CrawlerSourceKey);
    return { data: companies, total: companies.length };
  }

  @Post('save')
  async saveCompany(@Body() body: any) {
    const source = body.source || 'osm';
    const tags: string[] = body.tags || [];
    if (!isTechCompany(body.name ?? '', source, tags)) {
      throw new BadRequestException('Company does not meet tech filter criteria');
    }
    const company = await this.companiesRepository.save({
      name: body.name,
      website: body.website || null,
      careerUrl: body.careerUrl || null,
      careerPageFound: body.careerPageFound ?? false,
      city: body.city || null,
      country: body.country || null,
      lat: body.lat || null,
      lng: body.lng || null,
      osmId: body.osmId || null,
      placeId: body.placeId || null,
      source,
      tags,
    });
    return company;
  }

  @Post('purge-non-tech')
  async purgeNonTech() {
    const deleted = await this.companiesRepository.purgeNonTech();
    return { deleted };
  }

  @Get('saved')
  async getSaved(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('source') source: string = '',
    @Query('city') city: string = '',
    @Query('sort') sort: string = 'createdAt',
    @Query('order') order: string = 'desc',
  ) {
    return this.companiesRepository.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search: search || undefined,
      source: source || undefined,
      city: city || undefined,
      sort,
      order: order === 'asc' ? 'asc' : 'desc',
    });
  }

  @Delete(':id')
  async deleteCompany(@Param('id') id: string) {
    await this.companiesRepository.delete(id);
    return { success: true };
  }
}
