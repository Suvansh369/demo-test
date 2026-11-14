/**
 * Data Trust Engine & Gemini Generative Intelligence Routes.
 * Processes messy tabular datasets, enforces 4-tier data trust classifications,
 * and generates role action intelligence, civic briefings, and multilingual citizen advisories.
 */

const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const { uploadLimiter, aiLimiter } = require('../middleware/security');
const {
  processAirQualityDataset,
  parseRawText,
  parseExcelBuffer
} = require('../dataTrustEngine');
const {
  generateActionPlan,
  explainDataFindings,
  generateCivicBriefing,
  generateCitizenAdvisory
} = require('../geminiService');
const db = require('../db');
const { sanitizeString } = require('../middleware/validation');

function uploadMiddleware(req, res, next) {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload rejected.'
      });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
}

/**
 * POST /api/analyze/data
 * Upload or paste messy air quality datasets for 4-tier trust analysis
 */
router.post('/data', uploadLimiter, uploadMiddleware, async (req, res, next) => {
  try {
    let rawRows = [];
    let fileName = 'pasted_dataset.csv';

    if (req.file) {
      fileName = req.file.originalname;
      const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

      if (ext === '.xlsx' || ext === '.xls') {
        rawRows = parseExcelBuffer(req.file.buffer);
      } else {
        const textContent = req.file.buffer.toString('utf8');
        rawRows = parseRawText(textContent);
      }
    } else if (req.body && req.body.rawText) {
      fileName = 'pasted_records.csv';
      rawRows = parseRawText(req.body.rawText);
    } else {
      return res.status(400).json({
        success: false,
        error: 'No dataset provided. Please upload a CSV/Excel file or paste tabular data.'
      });
    }

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not parse any rows from the submitted data. Ensure columns are comma, tab, or semicolon separated.'
      });
    }

    // Process dataset through 4-Tier Data Trust Engine (Asynchronous Chunked Evaluation)
    const processed = await processAirQualityDataset(rawRows, fileName);

    // Save record to persistent DB (Asynchronous)
    await db.recordDataset({
      id: 'ds-' + Date.now(),
      fileName: processed.fileName,
      totalRecords: processed.totalRecords,
      analyzedParameter: processed.analyzedParameter,
      trustBreakdown: processed.trustBreakdown,
      uploadedAt: new Date().toISOString()
    });

    // Generate AI assessment explaining anomalies and civic implications
    let aiExplanation = null;
    try {
      aiExplanation = await explainDataFindings({
        fileName: processed.fileName,
        totalRows: processed.totalRecords,
        validRows: processed.trustBreakdown.GREEN,
        flaggedRows: processed.trustBreakdown.RED + processed.trustBreakdown.YELLOW + processed.trustBreakdown.GREY,
        stats: processed.statistics,
        sampleAnomalies: processed.flaggedObservations.slice(0, 8),
        columns: processed.detectedHeaders
      });
    } catch (aiErr) {
      console.warn('AI explanation error (fallback returned):', aiErr.message);
    }

    // Optimize response payload: limit sample rows to 50 for transfer efficiency
    const optimizedProcessed = {
      ...processed,
      sampleRows: (processed.evaluatedRows || []).slice(0, 50)
    };

    res.json({
      success: true,
      processed: optimizedProcessed,
      aiExplanation
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analyze/datasets
 * Returns summary history of previously analyzed datasets
 */
router.get('/datasets', async (req, res, next) => {
  try {
    const datasets = await db.getDatasets();
    res.json({
      success: true,
      count: datasets.length,
      datasets
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gemini/action-plan
 * Generates role-tailored action intelligence grounded in live data
 */
router.post('/action-plan', aiLimiter, async (req, res, next) => {
  try {
    const { role, aqi, category, prominentPollutant, sources, locality } = req.body || {};

    const plan = await generateActionPlan({
      role: role || 'citizen',
      aqi: aqi || 200,
      category: category || 'Moderate',
      prominentPollutant: prominentPollutant || 'PM2.5',
      sources: sources || [],
      locality: locality || 'Locality'
    });

    res.json({
      success: true,
      plan
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gemini/generate-report
 * Generates official Civic Briefings and multilingual Citizen Advisories
 */
router.post('/generate-report', aiLimiter, async (req, res, next) => {
  try {
    const {
      reportType,
      locality,
      aqi,
      category,
      prominentPollutant,
      sources,
      language,
      readingLevel
    } = req.body || {};

    const cleanLocality = sanitizeString(locality || 'Delhi', 100);
    const cleanCat = sanitizeString(category || 'Moderate', 30);
    const cleanPollutant = sanitizeString(prominentPollutant || 'PM2.5', 20);

    let reportMarkdown = '';

    if (reportType === 'internal_briefing') {
      const interventions = await db.getInterventions();
      reportMarkdown = await generateCivicBriefing({
        locality: cleanLocality,
        aqi: aqi || 200,
        category: cleanCat,
        prominentPollutant: cleanPollutant,
        sources: sources || [],
        interventions
      });
    } else {
      reportMarkdown = await generateCitizenAdvisory({
        locality: cleanLocality,
        aqi: aqi || 200,
        category: cleanCat,
        prominentPollutant: cleanPollutant,
        sources: sources || [],
        language: language || 'en',
        readingLevel: readingLevel || 'standard'
      });
    }

    res.json({
      success: true,
      reportType: reportType || 'citizen_advisory',
      locality: cleanLocality,
      language: language || 'en',
      reportMarkdown,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
