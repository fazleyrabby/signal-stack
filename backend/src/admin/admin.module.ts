import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule],
  providers: [AdminService, AuthService],
  controllers: [AdminController, AuthController],
  exports: [AdminService, AuthService],
})
export class AdminModule {}
