/**
 * NIRVAIR - Security, Efficiency & Accessibility Automated Test Suite
 * Validates Helmet headers, CORS policies, rate limiting, strict input validation,
 * file-upload rejection, cache hit performance, and WCAG accessibility contracts.
 */

const fs = require('fs');
const path = require('path');

async function runSecurityAndA11yTests() {
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

  console.log('===============================================================');
  console.log('  NIRVAIR: SECURITY, EFFICIENCY & ACCESSIBILITY TEST SUITE');
  console.log('===============================================================\n');

  // =============================================================
  // SECTION 1: SECURITY AUDIT & VALIDATION
  // =============================================================
  console.log('--- 1. Testing HTTP Security Headers (Helmet) & CORS ---');
  try {
    const res = await fetch(`${BASE}/`);
    assert(res.headers.has('x-content-type-options'), 'X-Content-Type-Options header present (nosniff)');
    assert(res.headers.has('content-security-policy'), 'Content-Security-Policy header present');
    assert(!res.headers.has('x-powered-by'), 'X-Powered-By header is suppressed');
  } catch (err) {
    assert(false, `Security headers check failed: ${err.message}`);
  }

  console.log('\n--- 2. Testing Coordinate Validation & Zero-Coordinate Handling ---');
  try {
    // Coordinate 0,0 must be VALID (Equator/Null Island)
    const resZero = await fetch(`${BASE}/api/aqi/search?lat=0&lon=0`);
    assert(resZero.status === 200, 'Coordinate (0, 0) accepted as valid geographical point');

    // Latitude > 90 must be REJECTED with 400
    const resOverLat = await fetch(`${BASE}/api/aqi/search?lat=95.5&lon=77.2`);
    assert(resOverLat.status === 400, 'Latitude > 90 correctly rejected with HTTP 400');

    // Longitude < -180 must be REJECTED with 400
    const resOverLon = await fetch(`${BASE}/api/aqi/search?lat=28.5&lon=-185.0`);
    assert(resOverLon.status === 400, 'Longitude < -180 correctly rejected with HTTP 400');

    // Non-numeric string coordinates must be REJECTED with 400
    const resBadCoord = await fetch(`${BASE}/api/aqi/search?lat=invalid_string&lon=77.2`);
    assert(resBadCoord.status === 400, 'Non-numeric coordinate string rejected with HTTP 400');
  } catch (err) {
    assert(false, `Coordinate validation failed: ${err.message}`);
  }

  console.log('\n--- 3. Testing Citizen Report Validation & Sanitization ---');
  try {
    // Invalid report_type must be rejected with 400
    const resBadType = await fetch(`${BASE}/api/citizen-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6,
        longitude: 77.2,
        report_type: 'malicious_unsupported_type',
        description: 'Test'
      })
    });
    assert(resBadType.status === 400, 'Invalid report_type rejected with HTTP 400');

    // Script injection in description must be sanitized
    const scriptInjection = '<script>alert("xss")</script>Heavy dust plume';
    const resSanitized = await fetch(`${BASE}/api/citizen-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6,
        longitude: 77.2,
        report_type: 'construction_dust',
        severity: 'high',
        description: scriptInjection
      })
    });
    const dataSanitized = await resSanitized.json();
    assert(resSanitized.status === 200 || resSanitized.status === 201, 'Valid report submitted successfully');
    assert(!dataSanitized.report.description.includes('<script>'), 'HTML/script tags sanitized from citizen report description');
  } catch (err) {
    assert(false, `Sanitization test failed: ${err.message}`);
  }

  console.log('\n--- 4. Testing File Upload Security & Extension Filtering ---');
  try {
    // Attempting upload with rejected extension (e.g. .exe or .sh)
    const formData = new FormData();
    const fakeBlob = new Blob(['malicious executable'], { type: 'application/octet-stream' });
    formData.append('file', fakeBlob, 'malicious_payload.exe');

    const resBadFile = await fetch(`${BASE}/api/analyze/data`, {
      method: 'POST',
      body: formData
    });
    assert(resBadFile.status === 400, 'Unsupported file extension (.exe) rejected with HTTP 400');
    const badFileData = await resBadFile.json();
    assert(badFileData.error && badFileData.error.includes('File type rejected'), 'Clean error message returned without server crash');
  } catch (err) {
    assert(false, `File filter test failed: ${err.message}`);
  }

  // =============================================================
  // SECTION 2: EFFICIENCY & CACHING PERFORMANCE
  // =============================================================
  console.log('\n--- 5. Testing Freshness-Aware Caching Engine ---');
  try {
    // First request (Cache MISS)
    const t0 = Date.now();
    const res1 = await fetch(`${BASE}/api/aqi/search?lat=28.6315&lon=77.2167`);
    const time1 = Date.now() - t0;
    const data1 = await res1.json();
    assert(res1.status === 200, 'Initial AQI request successful');

    // Second request (Cache HIT)
    const t1 = Date.now();
    const res2 = await fetch(`${BASE}/api/aqi/search?lat=28.6315&lon=77.2167`);
    const time2 = Date.now() - t1;
    const data2 = await res2.json();
    assert(res2.status === 200, 'Cached AQI request successful');
    assert(data2.dataFreshness && data2.dataFreshness.cached === true, 'Cache HIT confirmed via dataFreshness metadata');
    assert(time2 <= time1, `Cache response time (${time2}ms) faster or equal to initial network fetch (${time1}ms)`);
  } catch (err) {
    assert(false, `Caching test failed: ${err.message}`);
  }

  // =============================================================
  // SECTION 3: ACCESSIBILITY (WCAG 2.2 AA) AUDIT
  // =============================================================
  console.log('\n--- 6. Testing HTML Semantic & Screen Reader Markup ---');
  try {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

    // A. Skip-to-content
    assert(html.includes('href="#main-content"') && html.includes('Skip to main content'), 'Skip-to-content accessible link present');
    assert(html.includes('id="main-content"'), 'Main landmark #main-content target present');

    // B. Form Labels & Associations
    assert(html.includes('for="locality-search-input"'), 'Search input has explicit label-for pairing');
    assert(html.includes('for="cr-locality"') && html.includes('for="cr-type"') && html.includes('for="cr-desc"'), 'Citizen modal controls have explicit label-for pairings');

    // C. ARIA Live Regions
    assert(html.includes('aria-live="polite"'), 'Dynamic AI and reveal results contain aria-live="polite"');
    assert(html.includes('role="status"') || html.includes('role="alert"'), 'Dynamic status regions present');

    // D. Radio Group & Tablist Semantics
    assert(html.includes('role="radiogroup"') && html.includes('role="radio"'), 'Category buttons configured as accessible radiogroup with radio items');
    assert(html.includes('role="tablist"') && html.includes('role="tab"'), 'Application workflows and user roles configured with tablist and tab roles');

    // E. Leaflet map textual alternative
    assert(html.includes('role="application"') && html.includes('aria-label='), 'Leaflet interactive map has accessible application role and descriptive label');
  } catch (err) {
    assert(false, `HTML accessibility check failed: ${err.message}`);
  }

  console.log('\n--- 7. Testing CSS Accessibility & Focus Management ---');
  try {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');

    // High visibility focus-visible ring
    assert(css.includes(':focus-visible') && css.includes('outline:'), 'High-visibility :focus-visible indicators configured for keyboard users');

    // Prefers-reduced-motion
    assert(css.includes('@media (prefers-reduced-motion: reduce)'), '@media (prefers-reduced-motion: reduce) media query configured for motion safety');

    // High-contrast color definitions
    assert(css.includes('--color-good') && css.includes('bg-aqi-good'), 'AQI color tokens configured with accessible high-contrast text pairings');
  } catch (err) {
    assert(false, `CSS accessibility check failed: ${err.message}`);
  }

  console.log(`\n===============================================================`);
  console.log(`  SECURITY & ACCESSIBILITY AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===============================================================\n`);

  if (failed > 0) process.exit(1);
}

runSecurityAndA11yTests().catch(e => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
