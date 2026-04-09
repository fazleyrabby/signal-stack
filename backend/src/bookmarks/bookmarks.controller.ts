import { Controller, Get, Post, Req, Param, Query } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import type { Request } from 'express';

@Controller('api/bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post(':signalId')
  async toggleBookmark(@Req() req: Request, @Param('signalId') signalId: string) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || (req.headers['x-real-ip'] as string)
      || (req as any).ip 
      || 'unknown';
    const sessionId = `session_${ip}`;
    
    return this.bookmarksService.toggle(signalId, sessionId);
  }

  @Get()
  async getBookmarkedIds(@Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || (req.headers['x-real-ip'] as string)
      || (req as any).ip 
      || 'unknown';
    const sessionId = `session_${ip}`;
    
    return this.bookmarksService.getBySession(sessionId);
  }

  @Get('signals')
  async getBookmarkedSignals(
    @Req() req: Request,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || (req.headers['x-real-ip'] as string)
      || (req as any).ip 
      || 'unknown';
    const sessionId = `session_${ip}`;
    
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    
    return this.bookmarksService.getBookmarkedSignals(sessionId, limit, offset);
  }
}