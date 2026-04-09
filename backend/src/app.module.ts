import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { SignalsModule } from './signals/signals.module';
import { FeedModule } from './feed/feed.module';
import { ScorerModule } from './scorer/scorer.module';
import { AlertsModule } from './alerts/alerts.module';
import { AdminModule } from './admin/admin.module';
import { AIModule } from './ai/ai.module';
import { VisitorsModule } from './visitors/visitors.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    SignalsModule,
    FeedModule,
    ScorerModule,
    AlertsModule,
    VisitorsModule,
    AdminModule,
    AIModule,
    BookmarksModule,
  ],
})
export class AppModule {}
