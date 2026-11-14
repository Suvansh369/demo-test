/**
 * NIRVAIR - Civic Air-Quality Intelligence Platform
 * Main Server API & Static Application Host
 * Enhanced with Helmet security headers, CORS origin whitelisting,
 * rate limiters, strict input validation, caching, and graceful error handling.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');

const { calculateNAQI, getAQICategory } = require('./backend/naqi');
const { STATIONS, findNearestStation, calculateDistanceKm } = require('./backend/stations');
const { geocodeLocation, getNeighbourhoodSources } = require('./backend/geoService');
const db = require('./backend/db');
const cache = require('./backend/cache');
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

const {
  configureCors,
  configureHelmet,
  generalLimiter,
  aiLimiter,
  uploadLimiter,
  citizenReportLimiter,
  fileFilter
} = require('./backend/middleware/security');

const {
  isValidCoordinate,
  validateCitizenReport,
  validateIntervention,
  sanitizeString
} = require('./backend/middleware/validation');

const app = express();
const PORT = process.env.PORT || 3000;

// Apply Helmet Security Headers & CORS origin protection
app.use(configureHelmet());
app.use(configureCors());

// Apply global rate limiting across all API endpoints
app.use('/api/', generalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Secure Multer setup: File filter checks extensions & MIME types; 10MB size ceiling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: fileFilter
});

// ==========================================
// 1. AQI & PERCEPTION RETRIEVAL ENDPOINTS
// ==========================================

/**
 * Searches for a location and retrieves real live air quality measurements.
 * Features in-memory caching with explicit freshness metadata.
 */
app.get('/api/aqi/search', async (req, res, next) => {
  try {
    const query = req.query.query;
    let lat = req.query.lat !== undefined && req.query.lat !== null && req.query.lat !== ''
      ? parseFloat(req.query.lat)
      : null;
    let lon = req.query.lon !== undefined && req.query.lon !== null && req.query.lon !== ''
      ? parseFloat(req.query.lon)
      : null;
    let locationMeta = null;

    if (lat !== null && lon !== null) {
      if (!isValidCoordinate(lat, lon)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.'
        });
      }
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
      const sanitizedQuery = sanitizeString(query, 100);
      locationMeta = await geocodeLocation(sanitizedQuery);
      lat = locationMeta.latitude;
      lon = locationMeta.longitude;
    } else {
      locationMeta = await geocodeLocation('Delhi');
      lat = locationMeta.latitude;
      lon = locationMeta.longitude;
    }

    // Check Freshness-Aware In-Memory Cache (10-minute TTL)
    const cacheKey = `aqi_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry) {
      return res.json({
        success: true,
        location: locationMeta,
        reading: cachedEntry.value,
        dataFreshness: {
          cached: true,
          cachedAt: new Date(cachedEntry.cachedAt).toISOString(),
          ageSeconds: cachedEntry.ageSeconds,
          status: 'Fresh Ambient Observation (Cached)'
        }
      });
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
      co: current.carbon_monoxide !== undefined ? Math.round((current.carbon_monoxide / 1000) * 10) / 10 : null,
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

    const readingPayload = {
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
    };

    // Cache reading payload for 10 minutes (600 seconds)
    cache.set(cacheKey, readingPayload, 600);

    res.json({
      success: true,
      location: locationMeta,
      reading: readingPayload,
      dataFreshness: {
        cached: false,
        cachedAt: new Date().toISOString(),
        ageSeconds: 0,
        status: 'Live Real-Time Fetch'
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. NEIGHBOURHOOD INTELLIGENCE & CITIZEN REPORTING
// ==========================================

/**
 * Investigates potential nearby pollution sources
 */
app.get('/api/neighbourhood/sources', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const locality = sanitizeString(req.query.locality || 'Current Locality', 150);

    if (!isValidCoordinate(lat, lon)) {
      return res.status(400).json({
        success: false,
        error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) required.'
      });
    }

    const intel = await getNeighbourhoodSources(lat, lon, locality);
    res.json({ success: true, ...intel });
  } catch (err) {
    next(err);
  }
});

/**
 * Get all citizen reports
 */
app.get('/api/citizen-reports', (req, res) => {
  const locality = req.query.locality ? sanitizeString(req.query.locality, 100) : null;
  const reports = db.getCitizenReports({ locality });
  res.json({ success: true, reports });
});

/**
 * Submit a new citizen report (Rate limited & strictly validated)
 */
app.post('/api/citizen-reports', citizenReportLimiter, validateCitizenReport, (req, res) => {
  const { latitude, longitude, locality, report_type, severity, description } = req.body;
  const newReport = db.addCitizenReport({
    latitude,
    longitude,
    locality,
    report_type,
    severity,
    description
  });

  res.json({ success: true, report: newReport });
});

// ==========================================
// 3. AI ACTION INTELLIGENCE (GEMINI)
// ==========================================

/**
 * Generates personalized role-specific action intelligence (Rate limited)
 */
app.post('/api/gemini/action-plan', aiLimiter, async (req, res, next) => {
  try {
    const { role, aqi, category, prominentPollutant, sources, locality } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, error: 'User role is required (citizen, school, society, ward_officer).' });
    }

    const actionPlan = await generateActionPlan({
      role: sanitizeString(role, 50),
      aqi: Number(aqi) || 200,
      category: sanitizeString(category || 'Moderate', 50),
      prominentPollutant: sanitizeString(prominentPollutant || 'PM2.5', 20),
      sources: Array.isArray(sources) ? sources.slice(0, 10) : [],
      locality: sanitizeString(locality || 'Selected Locality', 150)
    });

    res.json({ success: true, actionPlan });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. PROFESSIONAL DATA ANALYSIS ENGINE
// ==========================================

/**
 * Ingests CSV, Excel (.xlsx/.xls), or pasted raw tabular text.
 * Rate limited and guarded with file extension & size validation.
 */
app.post('/api/analyze/data', uploadLimiter, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.code === 'LIMIT_FILE_SIZE'
          ? 'File rejected: exceeds maximum allowed size of 10MB.'
          : err.message
      });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    let rawRows = [];
    let fileName = 'pasted_tabular_data.csv';

    if (req.file) {
      fileName = sanitizeString(req.file.originalname, 100);
      const ext = path.extname(fileName).toLowerCase();

      if (ext === '.xlsx' || ext === '.xls') {
        rawRows = parseExcelBuffer(req.file.buffer);
      } else {
        const text = req.file.buffer.toString('utf8');
        rawRows = parseRawText(text);
      }
    } else if (req.body.pastedText) {
      fileName = sanitizeString(req.body.fileName || 'pasted_dataset.csv', 100);
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
      console.warn('AI analysis explanation skipped due to API latency/error:', aiErr.message);
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
    next(err);
  }
});

// ==========================================
// 5. INTERVENTION TRACKING & HISTORICAL MEMORY
// ==========================================

/**
 * Get all interventions
 */
app.get('/api/interventions', (req, res) => {
  const { role, status } = req.query;
  const items = db.getInterventions({
    role: role ? sanitizeString(role, 50) : null,
    status: status ? sanitizeString(status, 50) : null
  });
  res.json({ success: true, interventions: items });
});

/**
 * Create a new tracked intervention (Validated & sanitized)
 */
app.post('/api/interventions', validateIntervention, (req, res) => {
  const item = db.addIntervention(req.body);
  res.json({ success: true, intervention: item });
});

/**
 * Update an intervention (status, notes, deadline, assignee)
 */
app.patch('/api/interventions/:id', validateIntervention, (req, res) => {
  const updated = db.updateIntervention(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Intervention not found.' });
  }
  res.json({ success: true, intervention: updated });
});

/**
 * Delete an intervention
 */
app.delete('/api/interventions/:id', (req, res) => {
  const deleted = db.deleteIntervention(req.params.id);
  res.json({ success: true, deleted });
});

/**
 * Historical Comparison & Intervention Outcome Evaluator
 */
app.post('/api/interventions/compare', (req, res) => {
  const { locality, currentAQI } = req.body;
  const cleanLocality = locality ? sanitizeString(locality, 150) : null;
  const history = db.getAQIHistory(cleanLocality);
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
  const latestAQI = currentAQI !== undefined ? Number(currentAQI) : (history[0] ? history[0].aqi : 200);
  const baselineAQI = baseline.aqi;

  const deltaAQI = latestAQI - baselineAQI;
  const completedCount = interventions.filter(i => i.status === 'completed').length;
  const inProgressCount = interventions.filter(i => i.status === 'in_progress').length;

  let conditionOutcome = 'Unchanged';
  if (deltaAQI <= -15) conditionOutcome = 'Improved';
  else if (deltaAQI >= 15) conditionOutcome = 'Deteriorated';

  // Strict Scientific Guardrail: Correlation ≠ Causation
  const scientificAttributionNotice = completedCount > 0 && deltaAQI < 0
    ? `While AQI improved by ${Math.abs(deltaAQI)} points alongside ${completedCount} completed intervention(s), this reflects a temporal correlation. Atmospheric dispersion (wind velocity, boundary layer height, temperature inversions) cannot be separated from civic actions without calibrated meteorological modeling.`
    : `No direct causal link can be claimed between localized interventions and broad airshed AQI changes. Micro-level interventions protect local breathing zones even when regional air quality fluctuates.`;

  res.json({
    success: true,
    hasSufficientData: true,
    comparison: {
      locality: cleanLocality || baseline.locality,
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
});

// ==========================================
// 6. CIVIC BRIEFINGS & CITIZEN ADVISORIES
// ==========================================

/**
 * Generates an Internal Civic Briefing or Citizen Advisory (Rate limited)
 */
app.post('/api/gemini/generate-report', aiLimiter, async (req, res, next) => {
  try {
    const { type, locality, aqi, category, prominentPollutant, sources, language, readingLevel } = req.body;

    if (type === 'briefing') {
      const interventions = db.getInterventions();
      const reportMarkdown = await generateCivicBriefing({
        locality: sanitizeString(locality || 'National Capital Region', 150),
        aqi: Number(aqi) || 220,
        category: sanitizeString(category || 'Poor', 50),
        prominentPollutant: sanitizeString(prominentPollutant || 'PM2.5', 20),
        sources: Array.isArray(sources) ? sources.slice(0, 10) : [],
        interventions
      });
      return res.json({ success: true, type: 'briefing', content: reportMarkdown });
    } else {
      const reportMarkdown = await generateCitizenAdvisory({
        locality: sanitizeString(locality || 'Your Neighbourhood', 150),
        aqi: Number(aqi) || 180,
        category: sanitizeString(category || 'Moderate', 50),
        prominentPollutant: sanitizeString(prominentPollutant || 'PM2.5', 20),
        sources: Array.isArray(sources) ? sources.slice(0, 10) : [],
        language: language === 'hi' ? 'hi' : 'en',
        readingLevel: ['simple', 'technical'].includes(readingLevel) ? readingLevel : 'standard'
      });
      return res.json({ success: true, type: 'advisory', content: reportMarkdown });
    }
  } catch (err) {
    next(err);
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Secure Error Handler (No stack traces leaked to clients)
app.use((err, req, res, next) => {
  console.error('[NIRVAIR Error Handler]:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`NIRVAIR Civic Air-Quality Intelligence Platform`);
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Security: Helmet Active | CORS Configured | Rate Limiting Enabled`);
  console.log(`=================================================`);
});
