/**
 * Central Pollution Control Board (CPCB) - Indian National Air Quality Index (NAQI)
 * Deterministic calculation engine implementing official breakpoint interpolation.
 */

const BREAKPOINTS = {
  pm25: [
    { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
    { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
    { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
    { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
    { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
    { cLow: 250, cHigh: 500, iLow: 401, iHigh: 500 }
  ],
  pm10: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
    { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
    { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
    { cLow: 430, cHigh: 600, iLow: 401, iHigh: 500 }
  ],
  no2: [
    { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
    { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
    { cLow: 81, cHigh: 180, iLow: 101, iHigh: 200 },
    { cLow: 181, cHigh: 280, iLow: 201, iHigh: 300 },
    { cLow: 281, cHigh: 400, iLow: 301, iHigh: 400 },
    { cLow: 400, cHigh: 800, iLow: 401, iHigh: 500 }
  ],
  so2: [
    { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
    { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
    { cLow: 81, cHigh: 380, iLow: 101, iHigh: 200 },
    { cLow: 381, cHigh: 800, iLow: 201, iHigh: 300 },
    { cLow: 801, cHigh: 1600, iLow: 301, iHigh: 400 },
    { cLow: 1600, cHigh: 2400, iLow: 401, iHigh: 500 }
  ],
  co: [
    { cLow: 0, cHigh: 1.0, iLow: 0, iHigh: 50 },
    { cLow: 1.1, cHigh: 2.0, iLow: 51, iHigh: 100 },
    { cLow: 2.1, cHigh: 10.0, iLow: 101, iHigh: 200 },
    { cLow: 10.1, cHigh: 17.0, iLow: 201, iHigh: 300 },
    { cLow: 17.1, cHigh: 34.0, iLow: 301, iHigh: 400 },
    { cLow: 34.0, cHigh: 50.0, iLow: 401, iHigh: 500 }
  ],
  o3: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 101, cHigh: 168, iLow: 101, iHigh: 200 },
    { cLow: 169, cHigh: 208, iLow: 201, iHigh: 300 },
    { cLow: 209, cHigh: 748, iLow: 301, iHigh: 400 },
    { cLow: 748, cHigh: 1000, iLow: 401, iHigh: 500 }
  ]
};

function calculateSubIndex(pollutant, conc) {
  if (conc === null || conc === undefined || isNaN(conc) || conc < 0) return null;
  const bpList = BREAKPOINTS[pollutant];
  if (!bpList) return null;

  for (let bp of bpList) {
    if (conc >= bp.cLow && conc <= bp.cHigh) {
      const subIndex = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (conc - bp.cLow) + bp.iLow;
      return Math.round(subIndex);
    }
  }

  // Value exceeds highest breakpoint
  const last = bpList[bpList.length - 1];
  if (conc > last.cHigh) {
    return 500;
  }
  return null;
}

function getAQICategory(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) {
    return { name: 'Unknown', color: '#64748b', textColor: '#ffffff', healthImpact: 'Data not available.' };
  }
  if (aqi <= 50) {
    return {
      name: 'Good',
      range: '0-50',
      color: '#10b981', // Emerald 500
      textColor: '#ffffff',
      healthImpact: 'Minimal impact. Air quality is considered satisfactory, and air pollution poses little or no risk.',
      prominentAdvice: 'Ideal for outdoor physical activities and natural ventilation.'
    };
  }
  if (aqi <= 100) {
    return {
      name: 'Satisfactory',
      range: '51-100',
      color: '#84cc16', // Lime 500
      textColor: '#1e293b',
      healthImpact: 'Minor breathing discomfort to sensitive people including asthmatics and children.',
      prominentAdvice: 'Sensitive individuals should consider reducing intense prolonged exertion outdoors.'
    };
  }
  if (aqi <= 200) {
    return {
      name: 'Moderate',
      range: '101-200',
      color: '#eab308', // Yellow 500
      textColor: '#1e293b',
      healthImpact: 'Breathing discomfort to people with lung diseases, asthma, and heart conditions.',
      prominentAdvice: 'Limit prolonged outdoor exertion if experiencing discomfort; keep windows closed during peak traffic.'
    };
  }
  if (aqi <= 300) {
    return {
      name: 'Poor',
      range: '201-300',
      color: '#f97316', // Orange 500
      textColor: '#ffffff',
      healthImpact: 'Breathing discomfort to most people on prolonged exposure; respiratory illness in vulnerable groups.',
      prominentAdvice: 'Avoid intense outdoor exercise. Use N95/FFP2 masks near heavy traffic corridors.'
    };
  }
  if (aqi <= 400) {
    return {
      name: 'Very Poor',
      range: '301-400',
      color: '#ef4444', // Red 500
      textColor: '#ffffff',
      healthImpact: 'Respiratory illness on prolonged exposure. Significant cardiovascular and pulmonary stress.',
      prominentAdvice: 'Stay indoors as much as possible. Schools should shift physical education indoors.'
    };
  }
  return {
    name: 'Severe',
    range: '401-500+',
    color: '#7f1d1d', // Dark Maroon
    textColor: '#ffffff',
    healthImpact: 'Affects healthy people and seriously impacts those with existing pulmonary or heart diseases.',
    prominentAdvice: 'Emergency public health condition. Halt outdoor manual work; operate air purifiers; minimize travel.'
  };
}

/**
 * Calculates NAQI from standard pollutant readings.
 * According to CPCB, NAQI is the max of sub-indices, provided at least 3 pollutants are measured,
 * including either PM2.5 or PM10.
 */
function calculateNAQI(pollutants = {}) {
  const subIndices = {};
  let count = 0;
  let hasParticulate = false;

  // Normalize CO: if CO is in ug/m3, convert to mg/m3
  let coVal = pollutants.co;
  if (coVal !== undefined && coVal > 100) {
    coVal = coVal / 1000.0;
  }

  const normalized = {
    pm25: pollutants.pm25,
    pm10: pollutants.pm10,
    no2: pollutants.no2,
    so2: pollutants.so2,
    co: coVal,
    o3: pollutants.o3
  };

  for (const [key, val] of Object.entries(normalized)) {
    if (val !== undefined && val !== null && !isNaN(val)) {
      const sub = calculateSubIndex(key, Number(val));
      if (sub !== null) {
        subIndices[key] = sub;
        count++;
        if (key === 'pm25' || key === 'pm10') hasParticulate = true;
      }
    }
  }

  const subValues = Object.values(subIndices);
  if (subValues.length === 0) {
    return {
      aqi: null,
      prominentPollutant: null,
      subIndices: {},
      category: getAQICategory(null),
      sufficientData: false,
      note: 'No valid pollutant measurements provided.'
    };
  }

  // Determine dominant pollutant
  let maxSub = -1;
  let prominent = null;
  for (const [pol, sub] of Object.entries(subIndices)) {
    if (sub > maxSub) {
      maxSub = sub;
      prominent = pol;
    }
  }

  const sufficientData = (count >= 3 && hasParticulate) || (count >= 1 && hasParticulate);

  return {
    aqi: maxSub,
    prominentPollutant: prominent,
    subIndices,
    category: getAQICategory(maxSub),
    sufficientData,
    pollutants: normalized,
    note: sufficientData
      ? 'Calculated using official CPCB Indian National AQI formula.'
      : 'Hyperlocal estimate: Fewer than 3 standard pollutants recorded; particulate sub-index prioritized.'
  };
}

module.exports = {
  BREAKPOINTS,
  calculateSubIndex,
  getAQICategory,
  calculateNAQI
};
