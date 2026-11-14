/**
 * End-to-End API Integration & Verification Suite for NIRVAIR
 * Tests every required route and contract.
 */

async function runE2ETests() {
  const BASE = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  console.log('=== Starting NIRVAIR End-to-End Test Suite ===\n');

  // Test 1: Frontend Serving
  try {
    const res = await fetch(`${BASE}/`);
    assert(res.status === 200, 'Frontend index.html served on HTTP 200');
    const text = await res.text();
    assert(text.includes('NIRVAIR'), 'index.html contains NIRVAIR title');
    assert(text.includes('Do you really know what you\'re'), 'index.html contains signature challenge headline');
  } catch (e) {
    assert(false, `Frontend test failed: ${e.message}`);
  }

  // Test 2: Live AQI & CPCB NAQI calculation with Station Distance
  let liveAQIData = null;
  try {
    const res = await fetch(`${BASE}/api/aqi/search?query=Anand%20Vihar`);
    assert(res.status === 200, 'Live AQI search endpoint responds with 200');
    const data = await res.json();
    assert(data.success === true, 'AQI search returns success: true');
    assert(data.reading && data.reading.aqi !== null, `Real AQI calculated: ${data.reading.aqi} (${data.reading.category.name})`);
    assert(data.reading.nearestStation && data.reading.nearestStation.distanceKm !== undefined, `Nearest station found: ${data.reading.nearestStation.name} (${data.reading.nearestStation.distanceKm} km away)`);
    assert(data.reading.limitations && data.reading.limitations.spatialNote, 'Station-level vs Hyperlocal limitation notice present');
    liveAQIData = data;
  } catch (e) {
    assert(false, `Live AQI test failed: ${e.message}`);
  }

  // Test 3: Neighbourhood Intelligence & Mapped Infrastructure
  try {
    const res = await fetch(`${BASE}/api/neighbourhood/sources?lat=28.6508&lon=77.3152&locality=Anand%20Vihar`);
    assert(res.status === 200, 'Neighbourhood sources endpoint responds with 200');
    const data = await res.json();
    assert(data.success === true && data.sources && data.sources.length > 0, `Neighbourhood sources returned: ${data.sources.length} items`);
    const hasMapped = data.sources.some(s => s.category === 'MAPPED');
    const hasVerified = data.sources.some(s => s.category === 'VERIFIED');
    assert(hasMapped, 'Source classifications include [MAPPED] infrastructure');
    assert(hasVerified, 'Source classifications include [VERIFIED] monitoring station');
    assert(data.sources[0].explanation && data.sources[0].explanation.length > 10, 'Scientific rationale provided without claiming unproven causation');
  } catch (e) {
    assert(false, `Neighbourhood sources test failed: ${e.message}`);
  }

  // Test 4: Citizen Reporting Flow
  let createdReportId = null;
  try {
    const res = await fetch(`${BASE}/api/citizen-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.65,
        longitude: 77.31,
        locality: 'Anand Vihar ISBT',
        report_type: 'waste_burning',
        severity: 'high',
        description: 'E2E automated test: open garbage burning observed.'
      })
    });
    assert(res.status === 200, 'Citizen report submission responds with 200');
    const data = await res.json();
    assert(data.success && data.report.id, `Citizen report created: ${data.report.id}`);
    createdReportId = data.report.id;
  } catch (e) {
    assert(false, `Citizen report submission failed: ${e.message}`);
  }

  // Test 5: Professional Data Trust Engine on Messy Data
  try {
    const dirtyCsv = `SampleDate,Particulate_Matter_2.5,Site
2026-11-01 08:00,42.5 ug/m3,Site-1
2026-11-01 09:00,45.0,Site-1
2026-11-01 10:00,-25.0,Site-1
2026-11-01 11:00,,Site-1
2026-11-01 12:00,340.0,Site-1
2026-11-01 13:00,340.0,Site-1
2026-11-01 14:00,1950.0,Site-1
2026-11-01 14:00,1950.0,Site-1`;

    const res = await fetch(`${BASE}/api/analyze/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pastedText: dirtyCsv, fileName: 'messy_e2e.csv' })
    });
    assert(res.status === 200, 'Data Trust Engine endpoint responds with 200');
    const data = await res.json();
    assert(data.success === true, 'Data analysis returns success: true');
    assert(data.analysis.trustBreakdown.RED >= 1, 'Data Trust Engine correctly classified negative value as RED');
    assert(data.analysis.trustBreakdown.GREY >= 1, 'Data Trust Engine correctly classified missing value as GREY');
    assert(data.analysis.trustBreakdown.YELLOW >= 1, 'Data Trust Engine correctly classified frozen/spike value as YELLOW');
    assert(data.analysis.statistics.mean !== null, `Deterministic mean calculated: ${data.analysis.statistics.mean}`);
    assert(data.analysis.duplicateRecords >= 1, 'Duplicate detection flagged duplicate record');
  } catch (e) {
    assert(false, `Data Trust Engine test failed: ${e.message}`);
  }

  // Test 6: Persistent Intervention Memory & Historical Comparison
  try {
    // Create an intervention
    const intvRes = await fetch(`${BASE}/api/interventions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Anand Vihar',
        role: 'ward_officer',
        title: 'E2E Mechanical Wet Sweeper Deployment',
        rationale: 'Elevated roadside dust',
        evidence: 'PM10 spike recorded',
        assigned_to: 'Sanitation PWD',
        deadline: '2026-11-20',
        status: 'completed',
        verification_method: 'GPS truck tracking logs'
      })
    });
    assert(intvRes.status === 200, 'Intervention creation responds with 200');
    const intvData = await intvRes.json();
    assert(intvData.success && intvData.intervention.id, `Intervention created with ID: ${intvData.intervention.id}`);

    // Compare with history
    const cmpRes = await fetch(`${BASE}/api/interventions/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Anand Vihar',
        currentAQI: 220
      })
    });
    assert(cmpRes.status === 200, 'Intervention comparison responds with 200');
    const cmpData = await cmpRes.json();
    assert(cmpData.success === true, 'Comparison returned successfully');
    assert(cmpData.comparison && cmpData.comparison.scientificAttributionNotice, 'Scientific attribution notice present');
    assert(cmpData.comparison.attributionWarning === 'CORRELATION ≠ CAUSATION', 'Strict Correlation != Causation guardrail enforced');
  } catch (e) {
    assert(false, `Intervention Memory test failed: ${e.message}`);
  }

  console.log(`\n=== E2E Test Suite Complete: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runE2ETests().catch(e => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
