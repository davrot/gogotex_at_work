#!/usr/bin/env node
import fetch from 'node-fetch'
import { performance } from 'perf_hooks'

const URL = process.env.BENCH_URL || 'http://localhost:3000/internal/api/tokens/introspect'
const ITER = parseInt(process.env.BENCH_ITER || '20', 10)
const PAYLOAD = { token: 'dummy-token' }

async function run() {
  const latencies = []
  for (let i = 0; i < ITER; i++) {
    const t0 = performance.now()
    try {
      await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PAYLOAD) })
    } catch (err) {
    }
    const t1 = performance.now()
    latencies.push(t1 - t0)
  }
  latencies.sort((a,b)=>a-b)
  const p50 = latencies[Math.floor(latencies.length*0.5)]
  const p95 = latencies[Math.floor(latencies.length*0.95)]
  const p99 = latencies[Math.floor(latencies.length*0.99)]
  const output = { p50, p95, p99, samples: ITER }
  console.log(JSON.stringify(output))
  process.exit(0)
}

run()
#!/usr/bin/env node
// Simple benchmark harness for token introspection.
// Usage: TARGET_URL=http://localhost:3000 REQUESTS=200 CONCURRENCY=20 node bench.js

const http = require('http');
const https = require('https');
const { URL } = require('url');

const TARGET = process.env.TARGET_URL || 'http://localhost:3000';
const PATH = process.env.TARGET_PATH || '/internal/api/tokens/introspect';
const REQUESTS = parseInt(process.env.REQUESTS || '200', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '20', 10);
const USE_LOCAL_INTROSPECT = process.env.USE_LOCAL_INTROSPECT || 'true';

function now() { return Date.now(); }

function requestOnce(client, options, body) {
  return new Promise((resolve, reject) => {
    const start = now();
    const req = client.request(options, (res) => {
      // drain
      res.on('data', () => {});
      res.on('end', () => {
        resolve(Date.now() - start);
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const url = new URL(TARGET + PATH);
  const client = url.protocol === 'https:' ? https : http;
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      // Use a client-id header to simulate service-origin identification.
      'X-Service-Origin': process.env.SERVICE_ORIGIN || 'bench-client-1',
    },
  };

  let inFlight = 0;
  let completed = 0;
  const latencies = [];
  const errors = [];

  const bodyTemplate = process.env.TOKEN || 'invalid-token';

  return new Promise((resolve) => {
    function kick() {
      while (inFlight < CONCURRENCY && completed + inFlight < REQUESTS) {
        inFlight++;
        requestOnce(client, options, { token: bodyTemplate }).then((lat) => {
          latencies.push(lat);
          inFlight--;
          completed++;
          if (completed === REQUESTS) resolve({ latencies, errors });
          else kick();
        }).catch((err) => {
          errors.push(err.message || String(err));
          inFlight--;
          completed++;
          if (completed === REQUESTS) resolve({ latencies, errors });
          else kick();
        });
      }
    }
    kick();
  });
}

function quantiles(arr, q) {
  if (!arr || arr.length === 0) return null;
  const s = arr.slice().sort((a,b) => a-b);
  const idx = Math.floor(q * (s.length - 1));
  return s[idx];
}

async function runAll() {
  console.log('Benchmark starting', { TARGET, PATH, REQUESTS, CONCURRENCY });
  const runs = {}
  // Optionally perform a cold run by clearing caches if requested
  if (process.env.COLD_RUN === 'true' || process.env.COLD_RUN === '1') {
    console.log('Performing cold cache invalidation prior to run')
    // Attempt to post to cache invalidation endpoint if available
    try {
      await new Promise((resolve, reject) => {
        const url = new URL(TARGET + '/internal/api/cache/invalidate')
        const client = url.protocol === 'https:' ? https : http
        const req = client.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => { res.on('data', () => {}); res.on('end', resolve) })
        req.on('error', reject)
        req.write(JSON.stringify({ channel: 'auth.cache.invalidate', key: '*' }))
        req.end()
      })
      console.log('Cache invalidation requested')
    } catch (e) {
      console.warn('Failed to request cache invalidation', e && e.message ? e.message : e)
    }
    runs.cold = await run()
  }
  runs.warm = await run()
  return runs
}

(async () => {
  const result = await runAll();
  const latencies = result.latencies;
  if (result.cold) {
    const lat = result.cold.latencies
    const coldOut = { count: lat.length, errors: result.cold.errors.length, p50: quantiles(lat, 0.5), p95: quantiles(lat, 0.95), p99: quantiles(lat, 0.99), max: Math.max(...lat, 0), min: Math.min(...lat, 0) }
    console.log('BENCH_RESULT_JSON_COLD: ' + JSON.stringify(coldOut))
  }
  const latW = result.warm.latencies
  const warmOut = { count: latW.length, errors: result.warm.errors.length, p50: quantiles(latW, 0.5), p95: quantiles(latW, 0.95), p99: quantiles(latW, 0.99), max: Math.max(...latW, 0), min: Math.min(...latW, 0) }
  console.log('BENCH_RESULT_JSON_WARM: ' + JSON.stringify(warmOut))
  const errorsCount = (result.cold ? result.cold.errors.length : 0) + result.warm.errors.length
  process.exit(errorsCount > 0 ? 2 : 0)
})();
