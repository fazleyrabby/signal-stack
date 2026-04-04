import { NestFactory } from '@nestjs/core';
import { AIService } from '../scorer/ai.service';
import { AppModule } from '../app.module';

async function testAI() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ai = app.get(AIService);

  console.log('--- 🧠 SignalStack AI Connection Test ---');
  console.log('Testing with sample geopolitical signal...');

  const result = await ai.analyzeSignal(
    'Microsoft detects massive nation-state cyberattack on European power grid',
    'Microsoft security researchers have identified a coordinated campaign by a group linked to APT28 targeting electricity infrastructure in over 5 countries.'
  );

  if (result) {
    console.log('\x1b[32m✅ SUCCESS! AI Analysis Received:\x1b[0m');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\x1b[31m❌ FAILURE! Check your API Keys in .env\x1b[0m');
  }

  await app.close();
}

testAI();
