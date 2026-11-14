/**
 * NIRVAIR Input Validation & Sanitization Middleware.
 * Strictly validates geographical bounds, numerical parameters, enums, and sanitizes strings.
 * Dual-interface: functions as Express middleware OR as a direct validator function.
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
 * Dual-mode: supports validateCitizenReport(req, res, next) AND validateCitizenReport(data)
 */
function validateCitizenReport(dataOrReq, res, next) {
  const isMiddleware = res && typeof next === 'function';
  const body = isMiddleware ? (dataOrReq.body || {}) : (dataOrReq || {});

  const errors = [];
  const { latitude, longitude, report_type, severity, description, locality } = body;

  if (!isValidCoordinate(latitude, longitude)) {
    errors.push('Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.');
  }

  if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
    errors.push(`Invalid report_type. Allowed types: ${VALID_REPORT_TYPES.join(', ')}`);
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    errors.push(`Invalid severity level. Allowed values: ${VALID_SEVERITIES.join(', ')}`);
  }

  const sanitized = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    report_type: report_type || 'other',
    severity: severity || 'moderate',
    locality: sanitizeString(locality || 'Current Locality', 150),
    description: sanitizeString(description || '', 1000)
  };

  if (isMiddleware) {
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors[0], errors });
    }
    dataOrReq.body = sanitized;
    return next();
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validates Intervention submission payload
 * Dual-mode: supports validateIntervention(req, res, next) AND validateIntervention(data)
 */
function validateIntervention(dataOrReq, res, next) {
  const isMiddleware = res && typeof next === 'function';
  const body = isMiddleware ? (dataOrReq.body || {}) : (dataOrReq || {});

  const errors = [];
  const { role, title, timeframe, status, locality, rationale, evidence, assigned_to, deadline, notes, verification_method } = body;

  if (role && !VALID_ROLES.includes(role)) {
    errors.push(`Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`);
  }

  if (status && !VALID_INTERVENTION_STATUSES.includes(status)) {
    errors.push(`Invalid status. Allowed statuses: ${VALID_INTERVENTION_STATUSES.join(', ')}`);
  }

  const sanitized = {
    role: role || 'citizen',
    title: sanitizeString(title || 'Untitled Intervention', 200),
    timeframe: timeframe || 'immediate',
    status: status || 'proposed',
    locality: sanitizeString(locality || 'Locality', 150),
    rationale: sanitizeString(rationale || '', 1000),
    evidence: sanitizeString(evidence || '', 1000),
    assigned_to: sanitizeString(assigned_to || 'Unassigned', 150),
    deadline: deadline || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    notes: sanitizeString(notes || '', 1000),
    verification_method: sanitizeString(verification_method || '', 500)
  };

  if (isMiddleware) {
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors[0], errors });
    }
    dataOrReq.body = sanitized;
    return next();
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
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
