/**
 * Official End-to-End API Integration Test Suite for NIRVAIR
 * Built with Node.js Native Test Runner (node:test & node:assert/strict)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let server;
let baseUrl;
const TEST_PORT = 3002;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      baseUrl = `http://localhost:${TEST_PORT}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('NIRVAIR End-to-End Integration Suite', () => {

  it('1. GET / - serves accessible frontend HTML on HTTP 200', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('NIRVAIR'));
    assert.ok(html.includes('Do you really know what you\'re'));
    assert.ok(html.includes('login-gateway-overlay'), 'Login gateway modal present in DOM');
  });

  it('2. GET /api/health - verifies server health diagnostic status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.ok(data.apiKey.detected, 'Gemini API key is detected');
    assert.ok(data.gemini.ok, 'Gemini test ping responds successfully');
  });

  it('3. POST /api/auth/login - validates evaluator credentials (PromtWars / google)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'PromtWars', password: 'google' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token, 'Session token returned');
    assert.equal(data.user.username, 'PromtWars');
  });

  it('4. POST /api/auth/login - rejects invalid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WrongUser', password: 'badpassword' })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  it('5. POST /api/auth/logout - handles logout', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  it('6. GET /api/aqi/search - retrieves real live air quality and calculates CPCB NAQI', async () => {
    const res = await fetch(`${baseUrl}/api/aqi/search?query=Anand%20Vihar`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reading.aqi > 0);
    assert.ok(data.reading.category.name);
    assert.ok(data.reading.nearestStation);
    assert.ok(data.reading.limitations.spatialNote, 'Spatial disclaimer present');
  });

  it('7. GET /api/neighbourhood/sources - retrieves 4-tier nearby environmental sources', async () => {
    const res = await fetch(`${baseUrl}/api/neighbourhood/sources?lat=28.6508&lon=77.3152&locality=Anand%20Vihar`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.sources.length > 0);
    const categories = data.sources.map(s => s.category);
    assert.ok(categories.includes('VERIFIED') || categories.includes('MAPPED') || categories.includes('CITIZEN'));
  });

  it('8. POST /api/citizen-reports & GET /api/citizen-reports - records and returns reports', async () => {
    const postRes = await fetch(`${baseUrl}/api/citizen-reports`, {
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
    assert.ok(postData.report.id.startsWith('cr-'));

    const getRes = await fetch(`${baseUrl}/api/citizen-reports`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.reports.length > 0);
  });

  it('9. POST /api/analyze/data - parses pasted data and executes 4-tier data trust auditing', async () => {
    const sampleCsv = `Date,PM2.5,Location
2026-11-01 08:00,45.2,East
2026-11-01 09:00,-15.0,East
2026-11-01 10:00,,East
2026-11-01 11:00,120.0,East
2026-11-01 12:00,120.0,East`;

    const res = await fetch(`${baseUrl}/api/analyze/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: sampleCsv })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.processed.totalRecords, 5);
    assert.ok(data.processed.trustBreakdown.RED >= 1, 'Flagged negative reading as RED');
    assert.ok(data.processed.trustBreakdown.GREY >= 1, 'Flagged missing reading as GREY');
    assert.ok(data.aiExplanation);
  });

  it('10. CRUD on /api/interventions - manages civic memory lifecycle', async () => {
    // Create
    const createRes = await fetch(`${baseUrl}/api/interventions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'East Delhi Zone',
        role: 'ward_officer',
        title: 'E2E Water Sprinkling Operation',
        timeframe: 'immediate',
        rationale: 'High unpaved road dust resuspension',
        evidence: 'PM10 > 250 ug/m3',
        assigned_to: 'Sanitation Squad',
        deadline: '2026-11-20',
        status: 'proposed'
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const intId = created.intervention.id;

    // Update
    const updateRes = await fetch(`${baseUrl}/api/interventions/${intId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', notes: 'Tankers deployed' })
    });
    assert.equal(updateRes.status, 200);

    // Delete
    const delRes = await fetch(`${baseUrl}/api/interventions/${intId}`, {
      method: 'DELETE'
    });
    assert.equal(delRes.status, 200);
  });

  it('11. POST /api/interventions/compare - enforces CORRELATION != CAUSATION guardrail', async () => {
    const res = await fetch(`${baseUrl}/api/interventions/compare`, {
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
    assert.equal(data.delta, -60);
    assert.ok(data.scientificCaution.includes('DO NOT attribute this reduction solely to'));
    assert.ok(data.correlationDisclaimer.includes('CORRELATION ≠ CAUSATION'));
  });

  it('12. POST /api/gemini/action-plan - returns evidence-grounded action intelligence', async () => {
    const res = await fetch(`${baseUrl}/api/gemini/action-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'school',
        aqi: 245,
        category: 'Poor',
        prominentPollutant: 'PM2.5',
        locality: 'Central Delhi'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.plan.actions.immediate.length > 0);
    assert.ok(data.plan.actions.shortTerm.length > 0);
    assert.ok(data.plan.actions.longTerm.length > 0);
  });
});
