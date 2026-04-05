import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { categories, sources } from './schema';
import { eq } from 'drizzle-orm';

// Manual database connection for standalone script
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://signal:signal@localhost:5433/signalstack',
});

const db = drizzle(pool, { schema });

async function seed() {
    console.log('🌱 Seeding database...');

    // ✅ Categories (idempotent)
    await db
        .insert(categories)
        .values([
            { slug: 'geopolitics', name: 'Geopolitics' },
            { slug: 'technology', name: 'Technology' },
        ])
        .onConflictDoNothing();

    // ✅ Sources (idempotent by URL)
    const sourceData = [
        // 🌍 Geopolitics (high signal only)
        {
            name: 'Guardian World',
            url: 'https://www.theguardian.com/world/rss',
            categoryId: 'geopolitics',
            trustScore: 5,
        },
        {
            name: 'NYTimes World',
            url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
            categoryId: 'geopolitics',
            trustScore: 5,
        },
        {
            name: 'Al Jazeera',
            url: 'https://www.aljazeera.com/xml/rss/all.xml',
            categoryId: 'geopolitics',
            trustScore: 5,
        },
        {
            name: 'Foreign Affairs',
            url: 'https://www.foreignaffairs.com/rss.xml',
            categoryId: 'geopolitics',
            trustScore: 5,
        },

        // 💻 Technology (clean signal)
        {
            name: 'Ars Technica',
            url: 'https://feeds.arstechnica.com/arstechnica/index',
            categoryId: 'technology',
            trustScore: 5,
        },
        {
            name: 'The Verge',
            url: 'https://www.theverge.com/rss/index.xml',
            categoryId: 'technology',
            trustScore: 4,
        },
        {
            name: 'TechCrunch',
            url: 'https://techcrunch.com/feed/',
            categoryId: 'technology',
            trustScore: 4,
        },
        {
            name: 'MIT Tech Review',
            url: 'https://www.technologyreview.com/feed/',
            categoryId: 'technology',
            trustScore: 5,
        },
        {
            name: 'Wired',
            url: 'https://www.wired.com/feed/rss',
            categoryId: 'technology',
            trustScore: 4,
        },
    ];

    for (const src of sourceData) {
        const existing = await db
            .select()
            .from(sources)
            .where(eq(sources.url, src.url))
            .limit(1);

        if (existing.length === 0) {
            await db.insert(sources).values(src);
            console.log(`✅ Inserted: ${src.name}`);
        } else {
            console.log(`⏭️ Skipped (exists): ${src.name}`);
        }
    }

    await db.delete(sources).where(
        eq(sources.name, 'AP News')
    );

    await db.delete(sources).where(
        eq(sources.name, 'Hacker News')
    );

    await db.delete(sources).where(
        eq(sources.name, 'Hacker News Newest')
    );

    await db.delete(sources).where(
        eq(sources.name, 'Smashing Magazine')
    );

    await db.delete(sources).where(
        eq(sources.name, 'Bloomberg Markets')
    );

    await db.delete(sources).where(
        eq(sources.name, 'Financial Times World')
    );

    console.log('🌱 Seeding complete');
}

seed().then(() => process.exit(0));