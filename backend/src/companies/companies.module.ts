import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from './companies.repository';
import { DirectoryCrawlerService } from './directory-crawler.service';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, AIModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository, DirectoryCrawlerService],
})
export class CompaniesModule {}
