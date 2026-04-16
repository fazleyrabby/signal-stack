/**
 * SignalStack Load Test — k6 Script
 * 
 * Install k6:   brew install k6
 * 
 * Usage:
 *   Local smoke test:     k6 run scripts/loadtest.js
 *   Target your VPS:      k6 run -e BASE_URL=https://your-domain.com scripts/loadtest.js
 *   Custom scenario:      k6 run -e SCENARIO=spike scripts/loadtest.js
 * 
 * Scenarios (set via -e SCENARIO=<name>):
 *   smoke     — 10 VUs for 30s (sanity check)
 *   load      — ramp to 500 VUs over 5 minutes (standard load test)
 *   stress    — ramp to 2000 VUs over 10 minutes (find breaking point)
 *   spike     — sudden burst of 3000 VUs (test recovery)
 *   soak      — 200 VUs for 30 minutes (test memory leaks / degradation)
 * 
 * Note: To simulate 1M users you need distributed cloud load testing.
 *       See the "Scaling to 1M" section at the bottom of this file.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Configuration ──────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'smoke';

// ─── Custom Metrics ─────────────────────────────────────────
const errorRate = new Rate('errors');
const signalsLatency = new Trend('signals_latency', true);
const statsLatency = new Trend('stats_latency', true);
const sourcesLatency = new Trend('sources_latency', true);
const pageLatency = new Trend('page_latency', true);
const apiCalls = new Counter('api_calls');

// ─── Scenario Definitions ──────────────────────────────────
const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 10,
    duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '3m', target: 500 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 500 },
      { duration: '3m', target: 1000 },
      { duration: '3m', target: 2000 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '10s', target: 3000 },  // SPIKE
      { duration: '3m', target: 3000 },
      { duration: '10s', target: 100 },
      { duration: '1m', target: 0 },
    ],
  },
  soak: {
    executor: 'constant-vus',
    vus: 200,
    duration: '30m',
  },
};

export const options = {
  scenarios: {
    default: scenarios[SCENARIO] || scenarios.smoke,
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],  // 95% under 500ms, 99% under 1.5s
    errors: ['rate<0.05'],                             // Error rate under 5%
    signals_latency: ['p(95)<800'],
    stats_latency: ['p(95)<300'],
  },
};

// ─── Helpers ────────────────────────────────────────────────
const categories = ['geopolitics', 'technology'];
const sortOptions = ['created_at', 'score', 'published_at'];
const orders = ['asc', 'desc'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Virtual User Behavior ─────────────────────────────────
// Each VU simulates a real user session:
//   1. Load the page (HTML)
//   2. Fetch stats (StatsBar component)
//   3. Fetch geopolitics signals (left column)
//   4. Fetch technology signals (right column)
//   5. Fetch sources for each column
//   6. Wait 15s (SWR refresh interval), then repeat signals+stats

export default function () {

  // ── Step 1: Health Check (verify API is alive) ──
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { endpoint: 'health' },
    });
    pageLatency.add(res.timings.duration);
    apiCalls.add(1);
    check(res, { 'health ok': (r) => r.status === 200 }) || errorRate.add(1);
  });

  // ── Step 2: Dashboard Stats (fires immediately on page load) ──
  group('Stats Fetch', () => {
    const res = http.get(`${BASE_URL}/api/signals/stats`, {
      tags: { endpoint: 'stats' },
    });
    statsLatency.add(res.timings.duration);
    apiCalls.add(1);
    check(res, {
      'stats 200': (r) => r.status === 200,
      'stats has total': (r) => JSON.parse(r.body).total !== undefined,
    }) || errorRate.add(1);
  });

  // ── Step 3: Both Columns — Signals ──
  group('Signals Fetch', () => {
    const limit = 20;
    const sort = randomItem(sortOptions);
    const order = randomItem(orders);

    const responses = http.batch([
      ['GET', `${BASE_URL}/api/signals?limit=${limit}&categoryId=geopolitics&sort=${sort}&order=${order}`, null, { tags: { endpoint: 'signals_geo' } }],
      ['GET', `${BASE_URL}/api/signals?limit=${limit}&categoryId=technology&sort=${sort}&order=${order}`, null, { tags: { endpoint: 'signals_tech' } }],
    ]);

    for (const res of responses) {
      signalsLatency.add(res.timings.duration);
      apiCalls.add(1);
      check(res, {
        'signals 200': (r) => r.status === 200,
        'signals has data': (r) => {
          try { return JSON.parse(r.body).data.length >= 0; } catch { return false; }
        },
      }) || errorRate.add(1);
    }
  });

  // ── Step 4: Sources for Filter Dropdowns ──
  group('Sources Fetch', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/signals/sources?categoryId=geopolitics`, null, { tags: { endpoint: 'sources_geo' } }],
      ['GET', `${BASE_URL}/api/signals/sources?categoryId=technology`, null, { tags: { endpoint: 'sources_tech' } }],
    ]);

    for (const res of responses) {
      sourcesLatency.add(res.timings.duration);
      apiCalls.add(1);
      check(res, {
        'sources 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  });

  // ── Step 5: Simulate SWR Refresh Interval ──
  // Real users sit on the page, SWR refetches every 15s
  sleep(randomInt(10, 20));

  // ── Step 6: Refresh cycle (what SWR does in background) ──
  group('SWR Refresh', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/signals/stats`, null, { tags: { endpoint: 'stats_refresh' } }],
      ['GET', `${BASE_URL}/api/signals?limit=20&categoryId=geopolitics&sort=created_at&order=desc`, null, { tags: { endpoint: 'signals_refresh' } }],
      ['GET', `${BASE_URL}/api/signals?limit=20&categoryId=technology&sort=created_at&order=desc`, null, { tags: { endpoint: 'signals_refresh' } }],
    ]);

    for (const res of responses) {
      apiCalls.add(1);
      check(res, { 'refresh 200': (r) => r.status === 200 }) || errorRate.add(1);
    }
  });

  // Brief pause before next iteration
  sleep(randomInt(2, 5));
}

/**
 * ═══════════════════════════════════════════════════════════
 *  SCALING TO 1 MILLION USERS
 * ═══════════════════════════════════════════════════════════
 * 
 * From a single MacBook you can realistically simulate:
 *   - ~500-2000 Virtual Users (VUs) depending on your machine
 * 
 * To hit 1M concurrent users, you need DISTRIBUTED load testing:
 * 
 * ── Option 1: k6 Cloud (Easiest) ──
 *   1. Sign up at https://grafana.com/products/cloud/k6/
 *   2. Run: k6 cloud scripts/loadtest.js
 *   3. k6 spins up load generators across multiple regions
 *   4. Cost: Pay-per-test, ~$0.05 per VU-hour
 *   5. For 1M VUs × 10min = ~$8,333 (expensive!)
 * 
 * ── Option 2: Distributed k6 on AWS/GCP (Cheaper) ──
 *   1. Spin up 50-100 EC2 c5.2xlarge instances
 *   2. Each runs: k6 run -e SCENARIO=stress scripts/loadtest.js
 *   3. Each machine handles ~10,000-20,000 VUs
 *   4. Cost: ~$170/hr for 100 instances × 10 min = ~$28
 *   5. Use k6-operator on Kubernetes for orchestration
 * 
 * ── Option 3: Realistic Math (Recommended Approach) ──
 *   1M "users" ≠ 1M concurrent connections.
 *   Real user behavior:
 *     - Page loads once, then SWR polls every 15s
 *     - Average session: 2-5 minutes
 *     - At any given second, only ~5% are making requests
 *   
 *   So 1M monthly active users ≈ 
 *     ~50,000 concurrent sessions ≈ 
 *     ~3,333 API requests/second (at 15s poll interval)
 *   
 *   Test with: k6 run -e SCENARIO=stress scripts/loadtest.js
 *   If your server handles 2000 VUs smoothly, you can serve ~1M MAU.
 * 
 * ── Architecture Changes Needed for 1M Scale ──
 *   - Put Cloudflare/CDN in front for static assets
 *   - Add Redis caching for /api/signals and /api/signals/stats
 *   - Use connection pooling (PgBouncer) for PostgreSQL
 *   - Run multiple backend instances behind a load balancer
 *   - Consider read replicas for the database
 */
