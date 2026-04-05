import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Categories ---

  @Get('categories')
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  async createCategory(@Body() data: any) {
    return this.adminService.createCategory(data);
  }

  @Put('categories/:slug')
  async updateCategory(@Param('slug') slug: string, @Body() data: any) {
    return this.adminService.updateCategory(slug, data);
  }

  @Delete('categories/:slug')
  async deleteCategory(@Param('slug') slug: string) {
    return this.adminService.deleteCategory(slug);
  }

  // --- Sources ---

  @Get('sources')
  async getSources() {
    return this.adminService.getSources();
  }

  @Post('sources')
  async createSource(@Body() data: any) {
    return this.adminService.createSource(data);
  }

  @Put('sources/:id')
  async updateSource(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateSource(id, data);
  }

  @Delete('sources/:id')
  async deleteSource(@Param('id') id: string) {
    return this.adminService.deleteSource(id);
  }

  // --- System ---

  @Post('backup')
  async triggerBackup() {
    return this.adminService.triggerBackup();
  }
}
