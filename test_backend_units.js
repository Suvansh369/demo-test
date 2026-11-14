const { calculateNAQI, getAQICategory } = require('./backend/naqi');
const { findNearestStation, calculateDistanceKm } = require('./backend/stations');
const { geocodeLocation, getNeighbourhoodSources } = require('./backend/geoService');
const { processAirQualityDataset, parseRawText } = require('./backend/dataTrustEngine');
const db = require('./backend/db');

async function runTests() {
  console.log('--- 1. Testing CPCB NAQI Engine ---');
  const naqiGood = calculateNAQI({ pm25: 25, pm10: 45, no2: 30 });
  console.log('NAQI Good:', naqiGood.aqi, naqiGood.category.name);
  console.assert(naqiGood.aqi <= 50, 'Should be Good');

  const naqiSevere = calculateNAQI({ pm25: 310, pm10: 480, no2: 120 });
  console.log('NAQI Severe:', naqiSevere.aqi, naqiSevere.category.name);
  console.assert(naqiSevere.aqi >= 401, 'Should be Severe');

  console.log('--- 2. Testing Stations & Haversine Distance ---');
  // Coordinates for Connaught Place Delhi (28.6315, 77.2167)
  const station = findNearestStation(28.6315, 77.2167);
  console.log('Nearest station to Connaught Place:', station.name, `(${station.distanceKm} km away)`);
  console.assert(station.distanceKm < 5, 'Should be within 5 km of central Delhi station');

  console.log('--- 3. Testing Persistent Database Layer ---');
  const rep = db.addCitizenReport({
    latitude: 28.63,
    longitude: 77.21,
    locality: 'Connaught Place',
    report_type: 'construction_dust',
    severity: 'moderate',
    description: 'Unit test report'
  });
  console.log('Created report:', rep.id, rep.status);
  const reports = db.getCitizenReports({ locality: 'Connaught' });
  console.assert(reports.length > 0, 'Report should be queryable');

  console.log('--- 4. Testing Data Trust Engine on Messy Data ---');
  const messyCsv = `DateTime,Particulate_Matter_2.5,Location
2026-11-01 08:00,45.2 ug/m3,Site-A
2026-11-01 09:00,48.1,Site-A
2026-11-01 10:00,-12.0,Site-A
2026-11-01 11:00,,Site-A
2026-11-01 12:00,320.5,Site-A
2026-11-01 13:00,320.5,Site-A
2026-11-01 14:00,1800.0,Site-A
2026-11-01 14:00,1800.0,Site-A
`;
  const rawRows = parseRawText(messyCsv);
  console.log('Parsed raw rows count:', rawRows.length);
  const processed = processAirQualityDataset(rawRows, 'messy_test.csv');
  console.log('Trust breakdown:', processed.trustBreakdown);
  console.log('Mean valid PM2.5:', processed.statistics.mean);
  console.log('Flagged observations count:', processed.flaggedObservations.length);
  console.assert(processed.trustBreakdown.RED >= 1, 'Should have flagged negative reading as RED');
  console.assert(processed.trustBreakdown.GREY >= 1, 'Should have flagged empty reading as GREY');
  console.assert(processed.trustBreakdown.YELLOW >= 1, 'Should have flagged spike or freeze as YELLOW');

  console.log('--- ALL UNIT CHECKS PASSED SUCCESSFULLY ---');
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
