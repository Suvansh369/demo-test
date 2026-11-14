/**
 * End-to-End API Integration & Verification Suite for NIRVAIR
 * Native Node.js Test Runner (node:test)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('./server');

let server;
const PORT = 3003;
const BASE = `http://localhost:${PORT}`;

before(async () => {
  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

describe('NIRVAIR End-to-End Integration Tests', () => {

  it('Frontend index.html served on HTTP 200', async () => {
    const res = await fetch(`${BASE}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('NIRVAIR'));
    assert.ok(text.includes('Do you really know what you\'re'));
  });

  it('Evaluator Gateway login succeeds with PromtWars / google', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'PromtWars', password: 'google' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
  });

  it('Live AQI search endpoint responds with real calculated NAQI', async () => {
    const res = await fetch(`${BASE}/api/aqi/search?query=Anand%20Vihar`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reading.aqi > 0);
    assert.ok(data.reading.nearestStation);
  });

  it('Neighbourhood sources returns 4-tier infrastructure', async () => {
    const res = await fetch(`${BASE}/api/neighbourhood/sources?lat=28.6508&lon=77.3152&locality=Anand%20Vihar`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.sources.length > 0);
  });

  it('Citizen report creation and retrieval', async () => {
    const postRes = await fetch(`${BASE}/api/citizen-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6508,
        longitude: 77.3152,
        locality: 'Anand Vihar',
        report_type: 'waste_burning',
        severity: 'high',
        description: 'Smoke plume spotted near metro station'
      })
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    assert.equal(postData.success, true);
  });

  it('Data trust engine parses and audits uploaded data', async () => {
    const sampleCsv = `Date,PM2.5,Location
2026-11-01 08:00,45.2,East
2026-11-01 09:00,-15.0,East
2026-11-01 10:00,,East
2026-11-01 11:00,120.0,East
2026-11-01 12:00,120.0,East`;

    const res = await fetch(`${BASE}/api/analyze/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: sampleCsv })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.processed.totalRecords, 5);
  });

  it('Intervention comparison enforces correlation disclaimer', async () => {
    const res = await fetch(`${BASE}/api/interventions/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselineAqi: 280,
        postAqi: 220,
        interventionTitle: 'Deploy Anti-Smog Gun'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.correlationDisclaimer.includes('CORRELATION ≠ CAUSATION'));
  });

  it('Gemini Action Plan returns structured role interventions', async () => {
    const res = await fetch(`${BASE}/api/gemini/action-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ward_officer',
        aqi: 245,
        category: 'Poor',
        prominentPollutant: 'PM2.5',
        locality: 'Central Delhi'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.plan.actions.immediate);
  });
});
