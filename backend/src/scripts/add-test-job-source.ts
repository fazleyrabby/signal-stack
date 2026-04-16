import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sources } from '../database/schema';

async function addJobSource() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://signal:signal@localhost:5433/signalstack',
  });
  const db = drizzle(pool);

  console.log('Adding test job source...');
  
  await db.insert(sources).values({
    name: 'Remote OK',
    url: 'https://remoteok.com/remote-jobs.rss',
    categoryId: 'technology',
    type: 'job',
    trustScore: 5,
    isActive: true,
  }).onConflictDoNothing();

  console.log('✅ Remote OK job source added.');
  process.exit(0);
}

addJobSource();
