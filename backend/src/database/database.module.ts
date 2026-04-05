import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { BackupService } from './backup.service';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    BackupService,
    {
      provide: DATABASE_CONNECTION,
      useFactory: async (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable is required');
        }

        const pool = new Pool({
          connectionString: databaseUrl,
          max: 10,
        });

        // Test connection
        const client = await pool.connect();
        client.release();

        return drizzle(pool, { schema });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION, BackupService],
})
export class DatabaseModule {}

export type DrizzleDB = NodePgDatabase<typeof schema>;
