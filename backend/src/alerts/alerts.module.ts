import { Module, forwardRef } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { EmailService } from './email.service';
import { EmailScheduler } from './email.scheduler';
import { SignalsModule } from '../signals/signals.module';

@Module({
  imports: [forwardRef(() => SignalsModule)],
  providers: [DiscordService, EmailService, EmailScheduler],
  exports: [DiscordService, EmailService],
})
export class AlertsModule {}
