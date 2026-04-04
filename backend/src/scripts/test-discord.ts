import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

async function testWebhook() {
  if (!webhookUrl) {
    console.error('❌ Error: DISCORD_WEBHOOK_URL is not set in backend/.env');
    process.exit(1);
  }

  console.log('📡 Attempting to send test signal to Discord...');

  try {
    await axios.post(webhookUrl, {
      embeds: [
        {
          title: '🚨 CRITICAL SYSTEM TEST: SignalStack Ingestion Active',
          description: 'This is a test signal triggered by the SignalStack engineering team to confirm your Discord notification pipeline is healthy.',
          color: 0xff0000,
          fields: [
            { name: 'Node Status', value: 'ONLINE', inline: true },
            { name: 'Alert Protocol', value: 'V2-ALPHA', inline: true },
            { name: 'Security Hash', value: '`TEST-HASH-123`', inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'SignalStack Connectivity Test' },
        },
      ],
    });

    console.log('✅ Success! Test alert sent to Discord.');
  } catch (err: any) {
    console.error('❌ Failed to send alert:', err.response?.data || err.message);
  }
}

testWebhook();
