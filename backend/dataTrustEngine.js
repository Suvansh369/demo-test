/**
 * NIRVAIR Data Trust Engine & Deterministic Statistical Analysis Core.
 * Evaluates raw and messy environmental datasets.
 * Implements strict GREEN / YELLOW / RED / GREY observation classifications,
 * deterministic unit conversions, statistical profiling, and anomaly diagnostics.
 */

const XLSX = require('xlsx');

// Canonical alias dictionary (normalized with alphanumeric characters only)
const CANONICAL_ALIASES = {
  timestamp: ['timestamp', 'time', 'date', 'datetime', 'recordedat', 'readingtime', 'sampltime', 'dt'],
  pm25: ['pm25', 'pm2_5', 'pm2point5', 'particulatematter25', 'fineparticles', 'dustpm25', 'pm25ugm3'],
  pm10: ['pm10', 'pm_10', 'particulatematter10', 'coarseparticles', 'dustpm10', 'pm10ugm3'],
  aqi: ['aqi', 'airqualityindex', 'naqi', 'usaqi', 'compositeaqi', 'calculatedaqi', 'overallaqi'],
  no2: ['no2', 'nitrogendioxide', 'nitrogenoxide'],
  so2: ['so2', 'sulphurdioxide', 'sulfurdioxide'],
  co: ['co', 'carbonmonoxide', 'coconc'],
  o3: ['o3', 'ozone', 'troposphericozone'],
  location: ['location', 'station', 'site', 'sensorid', 'locality', 'stationname', 'place', 'ward']
};

function normalizeHeaderKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps ambiguous/messy headers to standardized parameter keys
 */
function standardizeColumns(headers = []) {
  const mapping = {};
  const standardized = [];

  for (const rawHeader of headers) {
    const norm = normalizeHeaderKey(rawHeader);
    let matchedStandard = null;

    for (const [stdKey, aliases] of Object.entries(CANONICAL_ALIASES)) {
      if (norm === stdKey || aliases.includes(norm) || aliases.some(alias => norm.includes(alias))) {
        matchedStandard = stdKey;
        break;
      }
    }

    if (matchedStandard) {
      mapping[rawHeader] = matchedStandard;
      standardized.push(matchedStandard);
    } else {
      mapping[rawHeader] = norm || rawHeader;
      standardized.push(norm || rawHeader);
    }
  }

  return { mapping, standardized };
}

/**
 * Parses raw tabular text (CSV, TSV, or semicolon-separated)
 */
function parseRawText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount) delimiter = ';';

  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0 || values.every(v => !v || v.trim() === '')) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j].trim() : '';
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses an uploaded Excel buffer into JSON rows
 */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}

/**
 * Evaluates individual readings under the 4-Tier Data Trust Framework
 */
function evaluateObservation(param, rawVal, prevVal, unit) {
  // GREY: Missing reading
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '' || String(rawVal).toUpperCase() === 'NA' || String(rawVal).toLowerCase() === 'null' || String(rawVal).toUpperCase() === 'NAN') {
    return {
      flag: 'GREY',
      status: 'Insufficient Evidence',
      reason: 'Reading is completely missing or recorded as blank / NULL / NaN.',
      excludedFromCalculations: true,
      requiresManualVerification: true,
      value: null,
      originalValue: rawVal
    };
  }

  const strVal = String(rawVal).trim();
  const numMatch = strVal.match(/^[-+]?\d*\.?\d+/);
  if (!numMatch) {
    return {
      flag: 'RED',
      status: 'Invalid Observation',
      reason: `Unparseable non-numeric character sequence: "${rawVal}".`,
      excludedFromCalculations: true,
      requiresManualVerification: true,
      value: rawVal,
      originalValue: rawVal
    };
  }

  let num = parseFloat(numMatch[0]);

  // Unit conversion if indicated in string or unit parameter
  const lower = strVal.toLowerCase();
  let convertedUnit = 'ug/m3';
  if (lower.includes('ppm') || unit === 'ppm') {
    if (param === 'co') {
      num = num * 1.145; // mg/m3
      convertedUnit = 'mg/m3';
    } else if (param === 'no2') {
      num = num * 1880; // ug/m3
      convertedUnit = 'ug/m3';
    } else if (param === 'so2') {
      num = num * 2620;
      convertedUnit = 'ug/m3';
    }
  } else if (lower.includes('ppb') || unit === 'ppb') {
    if (param === 'no2') num = num * 1.88;
    else if (param === 'so2') num = num * 2.62;
  }

  // RED: Physically impossible values
  if (num < 0) {
    return {
      flag: 'RED',
      status: 'Invalid Observation',
      reason: `Negative concentration (${num} ${convertedUnit}) violates physical laws of mass conservation.`,
      excludedFromCalculations: true,
      requiresManualVerification: true,
      value: num,
      originalValue: rawVal
    };
  }

  if (param === 'aqi' && num > 1500) {
    return {
      flag: 'RED',
      status: 'Invalid Observation',
      reason: `AQI of ${num} exceeds maximum atmospheric scale (> 1500 indicates electrical short or telemetry glitch).`,
      excludedFromCalculations: true,
      requiresManualVerification: true,
      value: num,
      originalValue: rawVal
    };
  }

  if ((param === 'pm25' || param === 'pm10') && num > 3000) {
    return {
      flag: 'RED',
      status: 'Invalid Observation',
      reason: `Particulate concentration of ${num} ug/m3 is physically implausible under atmospheric ambient conditions.`,
      excludedFromCalculations: true,
      requiresManualVerification: true,
      value: num,
      originalValue: rawVal
    };
  }

  // YELLOW: Suspicious observation requiring verification
  // Rate-of-change spike or sensor freeze
  if (prevVal !== null && prevVal !== undefined && !isNaN(prevVal)) {
    const delta = Math.abs(num - prevVal);
    // Rate of change spike check
    if (prevVal > 0 && delta > prevVal * 4.0 && delta > 150) {
      return {
        flag: 'YELLOW',
        status: 'Suspicious Reading',
        reason: `Extreme rate-of-change: shifted from ${prevVal} to ${num} (>400% surge). Potential localized plume or sensor calibration step.`,
        excludedFromCalculations: false,
        requiresManualVerification: true,
        value: num,
        originalValue: rawVal
      };
    }
    // Consecutive flatlining / sensor freeze
    if (num > 0 && Math.abs(num - prevVal) < 0.0001) {
      return {
        flag: 'YELLOW',
        status: 'Suspicious Reading',
        reason: 'Identical consecutive decimal value detected. Sensor output may be frozen or repeating stale packet.',
        excludedFromCalculations: false,
        requiresManualVerification: true,
        value: num,
        originalValue: rawVal
      };
    }
  }

  // GREEN: Reliable observation
  return {
    flag: 'GREEN',
    status: 'Reliable Observation',
    reason: 'Measurement passes range checks, rate-of-change thresholds, and physical validity boundaries.',
    excludedFromCalculations: false,
    requiresManualVerification: false,
    value: num,
    originalValue: rawVal
  };
}

/**
 * Deterministic statistical computations
 */
function calculateStatistics(values = []) {
  const clean = values.filter(v => v !== null && v !== undefined && !isNaN(v)).sort((a, b) => a - b);
  const n = clean.length;
  if (n === 0) {
    return { count: 0, mean: null, median: null, p95: null, min: null, max: null, stdDev: null };
  }

  const sum = clean.reduce((acc, v) => acc + v, 0);
  const mean = Math.round((sum / n) * 100) / 100;

  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? clean[mid] : Math.round(((clean[mid - 1] + clean[mid]) / 2) * 100) / 100;

  const p95Index = Math.min(Math.floor(0.95 * n), n - 1);
  const p95 = clean[p95Index];

  const min = clean[0];
  const max = clean[n - 1];

  const variance = clean.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n > 1 ? n - 1 : 1);
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

  return {
    count: n,
    mean,
    median,
    p95,
    min,
    max,
    stdDev
  };
}

/**
 * Full Pipeline for Data Trust Engine
 * Optimized with asynchronous chunked batch evaluation (Promise.all)
 * to process large datasets efficiently without blocking the event loop.
 */
async function processAirQualityDataset(rawRows, fileName = 'uploaded_data.csv', chunkSize = 250) {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error('Dataset is empty or contains no parseable records.');
  }

  // Safety limits to prevent memory exhaustion
  const MAX_ROWS = 10000;
  let rowsToProcess = rawRows;
  let rowLimitWarning = null;
  if (rawRows.length > MAX_ROWS) {
    rowsToProcess = rawRows.slice(0, MAX_ROWS);
    rowLimitWarning = `Dataset exceeded maximum row limit (${MAX_ROWS}); evaluated first ${MAX_ROWS} rows for performance stability.`;
  }

  const headers = Object.keys(rowsToProcess[0] || {}).slice(0, 50); // limit to 50 columns
  const { mapping } = standardizeColumns(headers);

  // Identify key pollutant column
  let targetParam = 'pm25';
  let targetCol = null;
  for (const [rawCol, stdKey] of Object.entries(mapping)) {
    if (stdKey === 'pm25' || stdKey === 'aqi' || stdKey === 'pm10') {
      targetParam = stdKey;
      targetCol = rawCol;
      break;
    }
  }

  if (!targetCol) {
    targetCol = headers.find(h => {
      const sampleVal = rawRows[0][h];
      return sampleVal !== undefined && !isNaN(parseFloat(sampleVal));
    }) || headers[0];
    targetParam = 'aqi';
  }

  // Partition rows into concurrent chunks
  const chunks = [];
  for (let i = 0; i < rowsToProcess.length; i += chunkSize) {
    chunks.push({
      startIdx: i,
      rows: rowsToProcess.slice(i, i + chunkSize)
    });
  }

  const seenFingerprints = new Set();
  let duplicateCount = 0;

  // Process chunks in parallel using Promise.all
  const chunkResults = await Promise.all(chunks.map(async (chunk) => {
    // Yield briefly to event loop
    await new Promise(resolve => setImmediate(resolve));

    const chunkEvaluatedRows = [];
    const chunkValidValues = [];
    const chunkFlaggedObs = [];

    let prevNumeric = null;

    for (let cIdx = 0; cIdx < chunk.rows.length; cIdx++) {
      const globalIdx = chunk.startIdx + cIdx;
      const raw = chunk.rows[cIdx];

      const fingerprint = JSON.stringify(raw);
      let isDuplicate = false;
      if (seenFingerprints.has(fingerprint)) {
        duplicateCount++;
        isDuplicate = true;
      } else {
        seenFingerprints.add(fingerprint);
      }

      const rawVal = raw[targetCol];
      const evalResult = evaluateObservation(targetParam, rawVal, prevNumeric);

      if (!evalResult.excludedFromCalculations && evalResult.value !== null) {
        chunkValidValues.push(evalResult.value);
        prevNumeric = evalResult.value;
      }

      if (evalResult.flag !== 'GREEN' || isDuplicate) {
        chunkFlaggedObs.push({
          rowIndex: globalIdx + 1,
          column: targetCol,
          parameter: targetParam,
          originalValue: rawVal,
          flag: isDuplicate && evalResult.flag === 'GREEN' ? 'YELLOW' : evalResult.flag,
          status: isDuplicate && evalResult.flag === 'GREEN' ? 'Duplicate Record' : evalResult.status,
          reason: isDuplicate ? 'Identical record repeated; potential duplicate sensor transmission.' : evalResult.reason,
          excludedFromCalculations: evalResult.excludedFromCalculations,
          requiresManualVerification: evalResult.requiresManualVerification || isDuplicate
        });
      }

      chunkEvaluatedRows.push({
        rowIndex: globalIdx + 1,
        originalData: raw,
        targetColumn: targetCol,
        parameter: targetParam,
        trustFlag: isDuplicate && evalResult.flag === 'GREEN' ? 'YELLOW' : evalResult.flag,
        evalResult,
        isDuplicate
      });
    }

    return {
      evaluatedRows: chunkEvaluatedRows,
      validValues: chunkValidValues,
      flaggedObservations: chunkFlaggedObs
    };
  }));

  // Consolidate chunked results
  const evaluatedRows = [];
  const validValues = [];
  const flaggedObservations = [];

  for (const cr of chunkResults) {
    evaluatedRows.push(...cr.evaluatedRows);
    validValues.push(...cr.validValues);
    flaggedObservations.push(...cr.flaggedObservations);
  }

  const stats = calculateStatistics(validValues);

  const trustBreakdown = {
    GREEN: evaluatedRows.filter(r => r.trustFlag === 'GREEN').length,
    YELLOW: evaluatedRows.filter(r => r.trustFlag === 'YELLOW').length,
    RED: evaluatedRows.filter(r => r.trustFlag === 'RED').length,
    GREY: evaluatedRows.filter(r => r.trustFlag === 'GREY').length
  };

  let trend = 'Stable';
  let percentageChange = 0;
  if (validValues.length >= 6) {
    const qSize = Math.floor(validValues.length / 4);
    const startAvg = validValues.slice(0, qSize).reduce((a, b) => a + b, 0) / qSize;
    const endAvg = validValues.slice(-qSize).reduce((a, b) => a + b, 0) / qSize;
    if (startAvg > 0) {
      percentageChange = Math.round(((endAvg - startAvg) / startAvg) * 100);
      if (percentageChange <= -10) trend = 'Improving (Decreasing)';
      else if (percentageChange >= 10) trend = 'Deteriorating (Increasing)';
      else trend = 'Stable / Flat';
    }
  }

  return {
    fileName,
    totalRecords: rowsToProcess.length,
    originalRecordCount: rawRows.length,
    rowLimitWarning,
    analyzedParameter: targetParam.toUpperCase(),
    analyzedColumn: targetCol,
    detectedHeaders: headers,
    columnMapping: mapping,
    trustBreakdown,
    duplicateRecords: duplicateCount,
    statistics: stats,
    trend: {
      direction: trend,
      percentageChange,
      basis: 'Deterministic comparison between opening quartile and closing quartile of validated observations.'
    },
    flaggedObservations,
    evaluatedRowsSample: evaluatedRows.slice(0, 50),
    originalRowsSample: rawRows.slice(0, 10)
  };
}

module.exports = {
  CANONICAL_ALIASES,
  standardizeColumns,
  parseRawText,
  parseExcelBuffer,
  evaluateObservation,
  calculateStatistics,
  processAirQualityDataset
};
