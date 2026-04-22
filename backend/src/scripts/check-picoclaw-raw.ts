import { NestFactory } from '@nestjs/core';
import { PicoClawService } from '../ai/picoclaw.service';
import { AppModule } from '../app.module';

async function checkPicoClawRaw() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const picoClaw = app.get(PicoClawService);

  console.log('--- 🦀 PicoClaw Raw Response Test ---');
  
  const result = await picoClaw.process('Testing token usage response', 0);

  console.log('Full Result:', JSON.stringify(result, null, 2));

  if (result) {
    const usage = (result as any)?.result?.usage ?? (result as any)?.usage;
    console.log('Detected usage:', usage);
  }

  await app.close();
}

checkPicoClawRaw().catch(console.error);
