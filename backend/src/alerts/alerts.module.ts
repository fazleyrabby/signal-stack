import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { EmailService } from './email.service';
import { EmailScheduler } from './email.scheduler';

@Module({
  providers: [DiscordService, EmailService, EmailScheduler],
  exports: [DiscordService, EmailService],
})
export class AlertsModule {}
