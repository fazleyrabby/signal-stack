import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupPath = path.join(process.cwd(), 'signalstack_backup.sql');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.logger.log('💾 Backup Service initialized');
  }

  /**
   * Automated Daily Backup at Midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutomatedBackup() {
    this.logger.log('⏰ Starting automated daily backup...');
    await this.runBackup();
  }

  /**
   * Manual Trigger for Backup
   */
  async triggerManualBackup() {
    this.logger.log('⚡ Manual backup triggered from Admin Panel');
    return await this.runBackup();
  }

  private async runBackup() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      this.logger.error('❌ DATABASE_URL not found for backup');
      throw new Error('DATABASE_URL is not defined');
    }

    try {
      // Create temporary backup file to avoid partial corruption
      const tempFile = `${this.backupPath}.tmp`;
      
      // pg_dump command using the connection string
      // --no-owner and --no-privileges to make it portable
      // --clean to include DROP TABLE statements
      const command = `pg_dump "${databaseUrl}" --no-owner --no-privileges --clean -f "${tempFile}"`;
      
      this.logger.log(`🛰️ Executing pg_dump...`);
      await execAsync(command);

      // Successfully dumped, rename to target file
      if (fs.existsSync(tempFile)) {
        fs.renameSync(tempFile, this.backupPath);
        this.logger.log(`✅ Backup successful: ${this.backupPath}`);
        return { 
          success: true, 
          path: 'signalstack_backup.sql', 
          timestamp: new Date().toISOString() 
        };
      }
    } catch (error) {
      this.logger.error(`❌ Backup failed: ${error.message}`);
      throw error;
    }
  }
}
