/**
 * NIRVAIR - Civic Air-Quality Intelligence Platform
 * Main Server API & Static Application Host
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const { calculateNAQI, getAQICategory } = require('./backend/naqi');
const { STATIONS, findNearestStation, calculateDistanceKm } = require('./backend/stations');
const { geocodeLocation, getNeighbourhoodSources } = require('./backend/geoService');
const db = require('./backend/db');
const {
  processAirQualityDataset,
  parseRawText,
  parseExcelBuffer
} = require('./backend/dataTrustEngine');
const {
  generateActionPlan,
  explainDataFindings,
  generateCivicBriefing,
  generateCitizenAdvisory
} = require('./backend/geminiService');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup upload middleware for CSV and Excel files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max file size
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. AQI & PERCEPTION RETRIEVAL ENDPOINTS
// ==========================================

/**
 * Searches for a location and retrieves real live air quality measurements
 */
app.get('/api/aqi/search', async (req, res) => {
  try {
    const query = req.query.query;
    let lat = req.query.lat ? parseFloat(req.query.lat) : null;
    let lon = req.query.lon ? parseFloat(req.query.lon) : null;
    let locationMeta = null;

    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
      locationMeta = {
        name: `Selected Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
        city: 'Selected Area',
        state: '',
        country: 'India',
        latitude: lat,
        longitude: lon,
        source: 'Interactive Coordinate Selection'
      };
    } else if (query) {
      locationMeta = await geocodeLocation(query);
      lat = locationMeta.latitude;
      lon = locationMeta.longitude;
    } else {
      // Default to Delhi Central
      locationMeta = await geocodeLocation('Delhi');
      lat = locationMeta.latitude;
      lon = locationMeta.longitude;
    }

    // Retrieve real live atmospheric pollutants from Open-Meteo Air Quality API
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&hourly=pm2_5,pm10&timezone=auto`;
    const aqiRes = await fetch(aqiUrl, { headers: { 'User-Agent': 'NIRVAIR-Civic-Platform/1.0' } });

    if (!aqiRes.ok) {
      throw new Error(`Open-Meteo API returned HTTP status ${aqiRes.status}`);
    }

    const aqiData = await aqiRes.json();
    const current = aqiData.current || {};

    const pollutants = {
      pm25: current.pm2_5 !== undefined ? Math.round(current.pm2_5 * 10) / 10 : null,
      pm10: current.pm10 !== undefined ? Math.round(current.pm10 * 10) / 10 : null,
      no2: current.nitrogen_dioxide !== undefined ? Math.round(current.nitrogen_dioxide * 10) / 10 : null,
      so2: current.sulphur_dioxide !== undefined ? Math.round(current.sulphur_dioxide * 10) / 10 : null,
      co: current.carbon_monoxide !== undefined ? Math.round((current.carbon_monoxide / 1000) * 10) / 10 : null, // convert ug to mg/m3
      o3: current.ozone !== undefined ? Math.round(current.ozone * 10) / 10 : null
    };

    // Calculate official Indian CPCB National AQI (NAQI)
    const naqiResult = calculateNAQI(pollutants);

    // Locate nearest official CAAQMS station
    const nearestStation = findNearestStation(lat, lon);

    // Record snapshot into history for memory tracking
    if (naqiResult.aqi) {
      db.recordAQISnapshot({
        locality: locationMeta.name,
        latitude: lat,
        longitude: lon,
        aqi: naqiResult.aqi,
        category: naqiResult.category.name,
        pm25: pollutants.pm25,
        pm10: pollutants.pm10,
        station_name: nearestStation ? nearestStation.name : 'Regional Ambient',
        station_distance_km: nearestStation ? nearestStation.distanceKm : 0
      });
    }

    res.json({
      success: true,
      location: locationMeta,
      reading: {
        aqi: naqiResult.aqi,
        category: naqiResult.category,
        prominentPollutant: naqiResult.prominentPollutant ? naqiResult.prominentPollutant.toUpperCase() : 'PM2.5',
        subIndices: naqiResult.subIndices,
        pollutants,
        timestamp: current.time || new Date().toISOString(),
        dataSource: 'Copernicus Atmospheric Monitoring Service (CAMS) & Open-Meteo Real-Time Atmospheric Feed',
        nearestStation: nearestStation ? {
          id: nearestStation.id,
          name: nearestStation.name,
          city: nearestStation.city,
          state: nearestStation.state,
          operator: nearestStation.operator,
          distanceKm: nearestStation.distanceKm,
          latitude: nearestStation.lat,
          longitude: nearestStation.lon
        } : null,
        limitations: {
          spatialNote: nearestStation
            ? `Nearest regulatory monitoring station (${nearestStation.name}) is ${nearestStation.distanceKm} km away. Regulatory stations monitor broad regional airsheds. Your hyperlocal doorstep exposure will vary based on adjacent traffic, street geometry, and ground-level dust.`
            : 'Regional atmospheric observation applied. Doorstep microclimates may vary with localized combustion.',
          isDoorstepMeasurement: false
        }
      }
    });
  } catch (err) {
    console.error('Error fetching live AQI:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve live air quality data.',
      details: err.message
    });
  }
});

// ==========================================
// 2. NEIGHBOURHOOD INTELLIGENCE & CITIZEN REPORTING
// ==========================================

/**
 * Investigates potential nearby pollution sources
 */
app.get('/api/neighbourhood/sources', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const locality = req.query.locality || 'Current Locality';

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ success: false, error: 'Valid latitude and longitude required.' });
    }

    const intel = await getNeighbourhoodSources(lat, lon, locality);
    res.json({ success: true, ...intel });
  } catch (err) {
    console.error('Error fetching neighbourhood sources:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all citizen reports
 */
app.get('/api/citizen-reports', (req, res) => {
  try {
    const locality = req.query.locality;
    const reports = db.getCitizenReports({ locality });
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Submit a new citizen report
 */
app.post('/api/citizen-reports', (req, res) => {
  try {
    const { latitude, longitude, locality, report_type, severity, description } = req.body;
    if (!latitude || !longitude || !report_type) {
      return res.status(400).json({ success: false, error: 'Latitude, longitude, and report type are required.' });
    }

    const newReport = db.addCitizenReport({
      latitude,
      longitude,
      locality,
      report_type,
      severity,
      description
    });

    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. AI ACTION INTELLIGENCE (GEMINI)
// ==========================================

/**
 * Generates personalized role-specific action intelligence
 */
app.post('/api/gemini/action-plan', async (req, res) => {
  try {
    const { role, aqi, category, prominentPollutant, sources, locality } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, error: 'User role is required (citizen, school, society, ward_officer).' });
    }

    const actionPlan = await generateActionPlan({
      role,
      aqi,
      category,
      prominentPollutant,
      sources,
      locality: locality || 'Selected Locality'
    });

    res.json({ success: true, actionPlan });
  } catch (err) {
    console.error('Error generating action plan:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. PROFESSIONAL DATA ANALYSIS ENGINE
// ==========================================

/**
 * Ingests CSV, Excel (.xlsx/.xls), or pasted raw tabular text.
 * Runs deterministic Data Trust Engine + Gemini plain-language interpretation.
 */
app.post('/api/analyze/data', upload.single('file'), async (req, res) => {
  try {
    let rawRows = [];
    let fileName = 'pasted_tabular_data.csv';

    if (req.file) {
      fileName = req.file.originalname;
      const ext = path.extname(fileName).toLowerCase();

      if (ext === '.xlsx' || ext === '.xls') {
        rawRows = parseExcelBuffer(req.file.buffer);
      } else {
        const text = req.file.buffer.toString('utf8');
        rawRows = parseRawText(text);
      }
    } else if (req.body.pastedText) {
      fileName = req.body.fileName || 'pasted_dataset.csv';
      rawRows = parseRawText(req.body.pastedText);
    } else {
      return res.status(400).json({
        success: false,
        error: 'No file or pasted text provided. Please upload a CSV/Excel file or paste tabular data.'
      });
    }

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not parse any records from the provided data. Please ensure valid headers and tabular structure.'
      });
    }

    // 1. Deterministic Data Trust Engine processing
    const processed = processAirQualityDataset(rawRows, fileName);

    // 2. Gemini Generative AI interpretation of structure and anomalies
    let aiExplanation = null;
    try {
      aiExplanation = await explainDataFindings({
        fileName,
        totalRows: processed.totalRecords,
        validRows: processed.trustBreakdown.GREEN,
        flaggedRows: processed.flaggedObservations.length,
        stats: processed.statistics,
        sampleAnomalies: processed.flaggedObservations.slice(0, 8),
        columns: processed.detectedHeaders
      });
    } catch (aiErr) {
      console.warn('AI analysis explanation skipped due to API error:', aiErr.message);
    }

    // 3. Store record in database audit trail
    db.recordDataset({
      id: 'ds-' + Date.now(),
      filename: fileName,
      uploaded_at: new Date().toISOString(),
      row_count: processed.totalRecords,
      valid_count: processed.trustBreakdown.GREEN,
      flagged_count: processed.flaggedObservations.length,
      summary_json: JSON.stringify(processed.statistics)
    });

    res.json({
      success: true,
      analysis: processed,
      aiExplanation
    });
  } catch (err) {
    console.error('Data analysis processing error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. INTERVENTION TRACKING & HISTORICAL MEMORY
// ==========================================

/**
 * Get all interventions
 */
app.get('/api/interventions', (req, res) => {
  try {
    const { role, status } = req.query;
    const items = db.getInterventions({ role, status });
    res.json({ success: true, interventions: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create a new tracked intervention
 */
app.post('/api/interventions', (req, res) => {
  try {
    const item = db.addIntervention(req.body);
    res.json({ success: true, intervention: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update an intervention (status, notes, deadline, assignee)
 */
app.patch('/api/interventions/:id', (req, res) => {
  try {
    const updated = db.updateIntervention(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Intervention not found.' });
    }
    res.json({ success: true, intervention: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete an intervention
 */
app.delete('/api/interventions/:id', (req, res) => {
  try {
    const deleted = db.deleteIntervention(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Historical Comparison & Intervention Outcome Evaluator
 * Compares current AQI reading or uploaded dataset with baseline history.
 */
app.post('/api/interventions/compare', (req, res) => {
  try {
    const { locality, currentAQI, currentPM25 } = req.body;
    const history = db.getAQIHistory(locality);
    const interventions = db.getInterventions();

    if (history.length < 2 && !history[0]) {
      return res.json({
        success: true,
        hasSufficientData: false,
        message: 'Insufficient historical observations recorded for this locality to evaluate longitudinal intervention efficacy.',
        interventions
      });
    }

    const baseline = history[history.length - 1] || history[0];
    const latestAQI = currentAQI !== undefined ? currentAQI : (history[0] ? history[0].aqi : 200);
    const baselineAQI = baseline.aqi;

    const deltaAQI = latestAQI - baselineAQI;
    const completedCount = interventions.filter(i => i.status === 'completed').length;
    const inProgressCount = interventions.filter(i => i.status === 'in_progress').length;

    let conditionOutcome = 'Unchanged';
    if (deltaAQI <= -15) conditionOutcome = 'Improved';
    else if (deltaAQI >= 15) conditionOutcome = 'Deteriorated';

    // Anti-Hallucination & Causation Guardrail:
    // Never claim intervention caused reduction without multi-station meteorological controls!
    const scientificAttributionNotice = completedCount > 0 && deltaAQI < 0
      ? `While AQI improved by ${Math.abs(deltaAQI)} points alongside ${completedCount} completed intervention(s), this reflects a temporal correlation. Atmospheric dispersion (wind velocity, boundary layer height, temperature inversions) cannot be separated from civic actions without calibrated meteorological modeling.`
      : `No direct causal link can be claimed between localized interventions and broad airshed AQI changes. Micro-level interventions protect local breathing zones even when regional air quality fluctuates.`;

    res.json({
      success: true,
      hasSufficientData: true,
      comparison: {
        locality: locality || baseline.locality,
        baselinePeriod: {
          aqi: baselineAQI,
          category: baseline.category,
          date: baseline.recorded_at
        },
        currentPeriod: {
          aqi: latestAQI,
          category: getAQICategory(latestAQI).name,
          date: new Date().toISOString()
        },
        deltaAQI,
        conditionOutcome,
        completedInterventionsCount: completedCount,
        inProgressInterventionsCount: inProgressCount,
        attributionWarning: 'CORRELATION ≠ CAUSATION',
        scientificAttributionNotice,
        isDataSufficientForCausalInference: false,
        dataSufficiencyReason: 'A minimum of 90 days continuous collocated meteorological and background station controls are required for regulatory causal attribution.'
      },
      interventions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. CIVIC BRIEFINGS & CITIZEN ADVISORIES
// ==========================================

/**
 * Generates an Internal Civic Briefing or Citizen Advisory
 */
app.post('/api/gemini/generate-report', async (req, res) => {
  try {
    const { type, locality, aqi, category, prominentPollutant, sources, language, readingLevel } = req.body;

    if (type === 'briefing') {
      const interventions = db.getInterventions();
      const reportMarkdown = await generateCivicBriefing({
        locality: locality || 'National Capital Region',
        aqi: aqi || 220,
        category: category || 'Poor',
        prominentPollutant: prominentPollutant || 'PM2.5',
        sources: sources || [],
        interventions
      });
      return res.json({ success: true, type: 'briefing', content: reportMarkdown });
    } else {
      const reportMarkdown = await generateCitizenAdvisory({
        locality: locality || 'Your Neighbourhood',
        aqi: aqi || 180,
        category: category || 'Moderate',
        prominentPollutant: prominentPollutant || 'PM2.5',
        sources: sources || [],
        language: language || 'en',
        readingLevel: readingLevel || 'standard'
      });
      return res.json({ success: true, type: 'advisory', content: reportMarkdown });
    }
  } catch (err) {
    console.error('Error generating report:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`NIRVAIR Civic Air-Quality Intelligence Platform`);
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`=================================================`);
});
