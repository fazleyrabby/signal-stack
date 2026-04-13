import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DATABASE_CONNECTION } from '../database/database.module';
import { signals } from '../database/schema';
import { eq, or, ilike, and } from 'drizzle-orm';
import { logEvent } from '../common/logger';

async function resetBoilerplateSignals() {
  console.log('🔄 Starting SignalStack Boilerplate Cleanup...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DATABASE_CONNECTION);

  // Common boilerplate phrases returned by LLMs when content is missing
  const boilerplatePhrases = [
    '%I don\'t see any content provided%',
    '%Please provide the content%',
    '%No content provided%',
    '%provide the content for me to summarize%',
    '%As an AI language model%'
  ];

  try {
    // 1. Identify affected signals
    const conditions = boilerplatePhrases.map(phrase => ilike(signals.aiSummary, phrase));
    
    const affected = await db
      .select({ id: signals.id, title: signals.title })
      .from(signals)
      .where(or(...conditions));

    if (affected.length === 0) {
      console.log('✅ No signals with boilerplate content found.');
    } else {
      console.log(`🔍 Found ${affected.length} signals with boilerplate content.`);

      // 2. Reset them so they are picked up for re-processing
      const result = await db
        .update(signals)
        .set({
          aiSummary: null,
          aiProcessed: false,
          aiFailed: false,
          aiProvider: null
        })
        .where(
          and(
            or(...conditions)
          )
        )
        .returning({ id: signals.id });

      console.log(`✨ Successfully reset ${result.length} signals for re-processing.`);
      
      logEvent('info', 'database_boilerplate_cleanup', {
        count: result.length,
        status: 'reset_for_retry'
      });
    }
  } catch (error: any) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await app.close();
    process.exit(0);
  }
}

resetBoilerplateSignals();
