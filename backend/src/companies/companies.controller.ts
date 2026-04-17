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
import { SkipThrottle } from '@nestjs/throttler';

@Controller('api/admin/companies')
@UseGuards(AdminGuard)
@SkipThrottle()
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companiesRepository: CompaniesRepository,
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

  @Post('save')
  async saveCompany(@Body() body: any) {
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
      tags: body.tags || [],
    });
    return company;
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
