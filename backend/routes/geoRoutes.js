/**
 * Geographic Information, Live Atmospheric AQI & Neighbourhood Intelligence Routes.
 * Implements CPCB CAAQMS official data feed with Open-Meteo CAMS fallback,
 * caching with freshness indicators, and spatial limitation notices.
 */

const express = require('express');
const router = express.Router();

const { calculateNAQI } = require('../naqi');
const { findNearestStation } = require('../stations');
const { geocodeLocation, getNeighbourhoodSources } = require('../geoService');
const { fetchGovtStationData } = require('../govtAQIService');
const db = require('../db');
const cache = require('../cache');
const { isValidCoordinate, validateCitizenReport, sanitizeString } = require('../middleware/validation');
const { citizenReportLimiter } = require('../middleware/security');

/**
 * Core AQI Search Handler
 * Resolves location, queries real official CPCB data or Open-Meteo CAMS atmospheric model,
 * and records history for memory tracking.
 */
async function handleAqiSearch(req, res, next) {
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

    // Locate nearest official CAAQMS station
    const nearestStation = findNearestStation(lat, lon);

    let pollutants = null;
    let naqiResult = null;
    let dataSource = 'Copernicus Atmospheric Monitoring Service (CAMS) & Open-Meteo Atmospheric Feed';
    let observationTime = new Date().toISOString();
    let isOfficialGovtFeed = false;

    // First attempt: Query official Central Pollution Control Board (CPCB) data.gov.in feed
    if (nearestStation && nearestStation.dataGovInName && nearestStation.distanceKm <= 40) {
      try {
        const govtData = await fetchGovtStationData(nearestStation.dataGovInName);
        if (govtData && govtData.naqi && govtData.naqi.aqi) {
          pollutants = govtData.pollutants;
          naqiResult = govtData.naqi;
          dataSource = govtData.source;
          observationTime = govtData.lastUpdate;
          isOfficialGovtFeed = true;
        }
      } catch (govtErr) {
        console.warn(`CPCB official feed unavailable for ${nearestStation.name}:`, govtErr.message);
      }
    }

    // Fallback: Real live atmospheric pollutants from Open-Meteo Air Quality API
    if (!pollutants || !naqiResult) {
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&hourly=pm2_5,pm10&timezone=auto`;
      const aqiRes = await fetch(aqiUrl, {
        headers: { 'User-Agent': 'NIRVAIR-Civic-Platform/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (!aqiRes.ok) {
        throw new Error(`Atmospheric API returned HTTP status ${aqiRes.status}`);
      }

      const aqiData = await aqiRes.json();
      const current = aqiData.current || {};

      pollutants = {
        pm25: current.pm2_5 !== undefined ? Math.round(current.pm2_5 * 10) / 10 : null,
        pm10: current.pm10 !== undefined ? Math.round(current.pm10 * 10) / 10 : null,
        no2: current.nitrogen_dioxide !== undefined ? Math.round(current.nitrogen_dioxide * 10) / 10 : null,
        so2: current.sulphur_dioxide !== undefined ? Math.round(current.sulphur_dioxide * 10) / 10 : null,
        co: current.carbon_monoxide !== undefined ? Math.round((current.carbon_monoxide / 1000) * 10) / 10 : null,
        o3: current.ozone !== undefined ? Math.round(current.ozone * 10) / 10 : null
      };

      // Calculate official Indian CPCB National AQI (NAQI)
      naqiResult = calculateNAQI(pollutants);
      observationTime = current.time || new Date().toISOString();
    }

    // Record snapshot into history for memory tracking (Async)
    if (naqiResult.aqi) {
      await db.recordAQISnapshot({
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
      timestamp: observationTime,
      dataSource,
      isOfficialGovtFeed,
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
}

// Support multiple URL route mappings for complete test & frontend compatibility
router.get('/aqi/search', handleAqiSearch);
router.get('/aqi', handleAqiSearch);
router.get('/live/search', handleAqiSearch);
router.get('/live/aqi', handleAqiSearch);
router.get('/live', handleAqiSearch);
router.get('/search', handleAqiSearch);
router.get('/', handleAqiSearch);

/**
 * GET /api/neighbourhood/sources
 * Returns 4-Tier Neighbourhood Intelligence sources around given coordinates
 */
async function handleNeighbourhoodSources(req, res, next) {
  try {
    let lat = req.query.lat !== undefined && req.query.lat !== null && req.query.lat !== ''
      ? parseFloat(req.query.lat)
      : 28.6315;
    let lon = req.query.lon !== undefined && req.query.lon !== null && req.query.lon !== ''
      ? parseFloat(req.query.lon)
      : 77.2167;

    if (!isValidCoordinate(lat, lon)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates provided.'
      });
    }

    const locality = sanitizeString(req.query.locality || 'Locality', 100);
    const sourcesCacheKey = `sources_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cachedSources = cache.get(sourcesCacheKey);
    if (cachedSources) {
      return res.json({
        success: true,
        locality,
        center: { lat, lon },
        totalSources: cachedSources.value.length,
        sources: cachedSources.value,
        cached: true
      });
    }

    const result = await getNeighbourhoodSources(lat, lon, locality);
    const sources = Array.isArray(result) ? result : (result.sources || []);
    cache.set(sourcesCacheKey, sources, 1800); // 30-minute cache

    res.json({
      success: true,
      locality,
      center: { lat, lon },
      totalSources: sources.length,
      sources
    });
  } catch (err) {
    next(err);
  }
}

router.get('/neighbourhood/sources', handleNeighbourhoodSources);
router.get('/sources', handleNeighbourhoodSources);

/**
 * Citizen Reports Endpoints
 */
async function handleGetCitizenReports(req, res, next) {
  try {
    const locality = req.query.locality ? sanitizeString(req.query.locality, 100) : null;
    const reports = await db.getCitizenReports(locality ? { locality } : {});
    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    next(err);
  }
}

async function handlePostCitizenReport(req, res, next) {
  try {
    const validation = validateCitizenReport(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors[0] || 'Invalid citizen report payload.'
      });
    }

    const newReport = await db.addCitizenReport(validation.sanitized);

    res.status(201).json({
      success: true,
      message: 'Citizen observation recorded successfully. Thank you for contributing ground truth.',
      report: newReport
    });
  } catch (err) {
    next(err);
  }
}

router.get('/citizen-reports', handleGetCitizenReports);
router.post('/citizen-reports', citizenReportLimiter, handlePostCitizenReport);
router.get('/reports', handleGetCitizenReports);
router.post('/reports', citizenReportLimiter, handlePostCitizenReport);

module.exports = router;
