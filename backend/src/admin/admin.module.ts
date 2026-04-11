import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';
import { FeedModule } from '../feed/feed.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LogsController } from './logs.controller';
import { AdminSourcesController } from './sources.controller';

@Module({
  imports: [DatabaseModule, AIModule, FeedModule, forwardRef(() => AlertsModule)],
  providers: [AdminService, AuthService],
  controllers: [
    AdminController,
    AuthController,
    LogsController,
    AdminSourcesController,
  ],
  exports: [AdminService, AuthService],
})
export class AdminModule {}
