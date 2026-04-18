import {
  Controller,
  Get,
  Post,
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

@Controller('api/admin/companies')
@UseGuards(AdminGuard)
@SkipThrottle()
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companiesRepository: CompaniesRepository,
    private readonly crawlerService: DirectoryCrawlerService,
  ) {}

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string = '10000',
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseInt(radius, 10);

    if (isNaN(latNum) || isNaN(lngNum)) {
      throw new BadRequestException('lat and lng are required');
    }

    const companies = await this.companiesService.findNearby(latNum, lngNum, radiusNum);
    return { data: companies, total: companies.length };
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
  ) {
    return this.companiesRepository.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Delete(':id')
  async deleteCompany(@Param('id') id: string) {
    await this.companiesRepository.delete(id);
    return { success: true };
  }
}
