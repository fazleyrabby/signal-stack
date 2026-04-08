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
  private readonly backupDir = path.join(process.cwd(), 'backups');
  private readonly backupPath = path.join(process.cwd(), 'backups', 'signalstack_backup.sql');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
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
      // Diagnostic: Check if pg_dump exists
      try {
        await execAsync('pg_dump --version');
      } catch (e) {
        this.logger.error('❌ CRITICAL: pg_dump is not installed in the container environment. Rebuild recommended.');
        throw new Error('pg_dump binary not found');
      }

      // Create temporary backup file
      const tempFile = `${this.backupPath}.tmp`;
      
      const command = `pg_dump "${databaseUrl}" --no-owner --no-privileges --clean -f "${tempFile}"`;
      
      this.logger.log(`🛰️ Executing pg_dump...`);
      const { stderr } = await execAsync(command);

      if (stderr && stderr.includes('error')) {
        this.logger.warn(`⚠️ pg_dump warning: ${stderr}`);
      }

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
      const detail = error.stderr || error.message;
      this.logger.error(`❌ Backup failed: ${detail}`);
      throw new Error(`Database backup failed: ${detail}`);
    }
  }
}
