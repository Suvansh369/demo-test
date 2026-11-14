/**
 * NIRVAIR Input Validation & Sanitization Middleware.
 * Strictly validates geographical bounds, numerical parameters, enums, and sanitizes strings.
 */

const VALID_REPORT_TYPES = ['waste_burning', 'construction_dust', 'road_dust', 'industrial_smoke', 'other'];
const VALID_SEVERITIES = ['low', 'moderate', 'high', 'severe'];
const VALID_ROLES = ['citizen', 'school', 'society', 'ward_officer', 'housing_society'];
const VALID_INTERVENTION_STATUSES = ['proposed', 'in_progress', 'completed', 'abandoned'];

/**
 * Validates geographical coordinates (Latitude: -90 to +90, Longitude: -180 to +180).
 * Specifically handles coordinate values of 0 correctly without treating them as falsy!
 */
function isValidCoordinate(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return false;
  }
  const nLat = Number(lat);
  const nLon = Number(lon);

  if (isNaN(nLat) || isNaN(nLon)) return false;
  if (nLat < -90 || nLat > 90) return false;
  if (nLon < -180 || nLon > 180) return false;

  return true;
}

/**
 * Strips script tags, HTML tags, and potential injection vectors.
 */
function sanitizeString(str, maxLength = 500) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates Citizen Report submission payload
 */
function validateCitizenReport(req, res, next) {
  const { latitude, longitude, report_type, severity, description, locality } = req.body;

  if (!isValidCoordinate(latitude, longitude)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.'
    });
  }

  if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid report_type. Allowed types: ${VALID_REPORT_TYPES.join(', ')}`
    });
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid severity level. Allowed values: ${VALID_SEVERITIES.join(', ')}`
    });
  }

  // Sanitize fields
  req.body.locality = sanitizeString(locality || 'Current Locality', 150);
  req.body.description = sanitizeString(description || '', 1000);
  req.body.severity = severity || 'moderate';

  next();
}

/**
 * Validates Intervention submission payload
 */
function validateIntervention(req, res, next) {
  const { role, title, timeframe, status } = req.body;

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`
    });
  }

  if (status && !VALID_INTERVENTION_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Allowed statuses: ${VALID_INTERVENTION_STATUSES.join(', ')}`
    });
  }

  if (title) req.body.title = sanitizeString(title, 200);
  if (req.body.rationale) req.body.rationale = sanitizeString(req.body.rationale, 1000);
  if (req.body.evidence) req.body.evidence = sanitizeString(req.body.evidence, 1000);
  if (req.body.assigned_to) req.body.assigned_to = sanitizeString(req.body.assigned_to, 150);
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes, 1000);
  if (req.body.verification_method) req.body.verification_method = sanitizeString(req.body.verification_method, 500);

  next();
}

module.exports = {
  isValidCoordinate,
  sanitizeString,
  validateCitizenReport,
  validateIntervention,
  VALID_REPORT_TYPES,
  VALID_SEVERITIES,
  VALID_ROLES,
  VALID_INTERVENTION_STATUSES
};
