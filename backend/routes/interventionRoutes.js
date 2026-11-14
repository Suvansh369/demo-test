/**
 * Intervention Memory & Accountability Routes for NIRVAIR.
 * Manages institutional tracking, lifecycle commits, before/after comparisons,
 * and enforces the strict CORRELATION ≠ CAUSATION civic evaluation guardrail.
 */

const express = require('express');
const router = express.Router();

const db = require('../db');
const { validateIntervention, sanitizeString } = require('../middleware/validation');

/**
 * GET /api/interventions
 * Retrieves logged civic interventions with optional role or status filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const role = req.query.role ? sanitizeString(req.query.role, 30) : null;
    const status = req.query.status ? sanitizeString(req.query.status, 30) : null;

    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.status = status;

    const interventions = await db.getInterventions(filter);
    res.json({
      success: true,
      count: interventions.length,
      interventions
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interventions
 * Creates and commits a new role-tailored civic intervention
 */
router.post('/', async (req, res, next) => {
  try {
    const validation = validateIntervention(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors[0] || 'Invalid intervention payload.'
      });
    }

    const created = await db.addIntervention(validation.sanitized);
    res.status(201).json({
      success: true,
      message: 'Intervention logged into civic memory successfully.',
      intervention: created
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/interventions/:id
 * Updates intervention lifecycle status or execution verification notes
 */
async function handleInterventionUpdate(req, res, next) {
  try {
    const id = req.params.id;
    const updates = {};

    if (req.body.status) {
      const validStatuses = ['proposed', 'in_progress', 'completed', 'blocked', 'abandoned'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, error: 'Invalid intervention status.' });
      }
      updates.status = req.body.status;
    }

    if (req.body.notes !== undefined) {
      updates.notes = sanitizeString(req.body.notes, 1000);
    }

    if (req.body.verification_method !== undefined) {
      updates.verification_method = sanitizeString(req.body.verification_method, 500);
    }

    if (req.body.assigned_to !== undefined) {
      updates.assigned_to = sanitizeString(req.body.assigned_to, 100);
    }

    const updated = await db.updateIntervention(id, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Intervention with ID "${id}" not found.`
      });
    }

    res.json({
      success: true,
      message: 'Intervention updated successfully.',
      intervention: updated
    });
  } catch (err) {
    next(err);
  }
}

router.put('/:id', handleInterventionUpdate);
router.patch('/:id', handleInterventionUpdate);

/**
 * DELETE /api/interventions/:id
 * Removes an intervention from memory
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const deleted = await db.deleteIntervention(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Intervention with ID "${id}" not found.`
      });
    }

    res.json({
      success: true,
      message: 'Intervention deleted from memory.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interventions/compare
 * Evaluates before-and-after atmospheric measurements across an intervention period.
 * Strict Guardrail: Always asserts CORRELATION DOES NOT EQUAL CAUSATION.
 */
router.post('/compare', (req, res, next) => {
  try {
    const { baselineAqi, postAqi, interventionTitle, timeElapsedDays } = req.body || {};

    const base = parseFloat(baselineAqi);
    const post = parseFloat(postAqi);

    if (isNaN(base) || isNaN(post)) {
      return res.status(400).json({
        success: false,
        error: 'Both baseline AQI and post-intervention AQI numerical values are required.'
      });
    }

    const delta = Math.round((post - base) * 10) / 10;
    const percentChange = Math.round(((post - base) / base) * 100);

    let evaluation = '';
    let scientificCaution = '';

    if (delta < 0) {
      evaluation = `Observed AQI decreased by ${Math.abs(delta)} points (${Math.abs(percentChange)}% improvement) following the implementation window.`;
      scientificCaution = `CRITICAL CIVIC AUDIT NOTICE: While ambient air quality improved, atmospheric dilution is heavily governed by synoptic weather patterns (such as planetary boundary layer height shifts, wind velocity changes, and solar radiation). DO NOT attribute this reduction solely to "${interventionTitle || 'the intervention'}". A multi-week localized tracer study and meteorological normalization are mandatory before claiming causal success.`;
    } else if (delta > 0) {
      evaluation = `Observed AQI increased by ${delta} points (${percentChange}% deterioration) following the implementation window.`;
      scientificCaution = `CRITICAL CIVIC AUDIT NOTICE: An increase in ambient AQI does not necessarily indicate intervention failure. Seasonal thermal inversions, regional biomass smoke transport, or calm wind conditions frequently mask the beneficial effects of local dust suppression.`;
    } else {
      evaluation = 'No net change in observed AQI between baseline and follow-up intervals.';
      scientificCaution = 'Air quality indices remained stable. Continuous multi-station observation recommended.';
    }

    res.json({
      success: true,
      baselineAqi: base,
      postAqi: post,
      delta,
      percentChange,
      evaluation,
      scientificCaution,
      correlationDisclaimer: 'CORRELATION ≠ CAUSATION: Ambient air quality fluctuations are multifactorial. Regional meteorology, wind velocity, and transboundary advection must always be isolated before assigning causality to any single civic action.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interventions/history
 * Returns historical AQI snapshots for memory auditing
 */
router.get('/history', async (req, res, next) => {
  try {
    const locality = req.query.locality ? sanitizeString(req.query.locality, 100) : null;
    const history = await db.getAQIHistory(locality);
    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
