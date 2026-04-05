import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LogsController } from './logs.controller';

@Module({
  imports: [DatabaseModule],
  providers: [AdminService, AuthService],
  controllers: [AdminController, AuthController, LogsController],
  exports: [AdminService, AuthService],
})
export class AdminModule {}
