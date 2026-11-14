/**
 * Persistent Storage Layer for NIRVAIR.
 * Stores citizen reports, interventions, historical AQI snapshots, and uploaded dataset records.
 * Uses atomic JSON persistence to ensure zero native build issues and guaranteed portability.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'nirvair_db.json');

const INITIAL_DB = {
  citizen_reports: [
    {
      id: 'cr-init-1',
      latitude: 28.6360,
      longitude: 77.2010,
      locality: 'Connaught Place / Mandir Marg, Delhi',
      report_type: 'construction_dust',
      severity: 'moderate',
      description: 'Uncovered aggregate dumping and heavy dust from commercial renovation near inner circle.',
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      status: 'pending'
    },
    {
      id: 'cr-init-2',
      latitude: 28.6508,
      longitude: 77.3152,
      locality: 'Anand Vihar ISBT, Delhi',
      report_type: 'waste_burning',
      severity: 'high',
      description: 'Smoldering dry leaves and municipal refuse burning along drainage embankment.',
      timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
      status: 'verified'
    }
  ],
  interventions: [
    {
      id: 'int-init-1',
      locality: 'Anand Vihar, Delhi',
      role: 'ward_officer',
      title: 'Deploy Anti-Smog Gun & Wet Sweeping',
      timeframe: 'immediate',
      rationale: 'Elevated PM10 readings due to heavy unpaved shoulder dust and bus movement.',
      evidence: 'PM10 concentration 280 ug/m3; Anand Vihar CAAQMS shows Poor category.',
      assigned_to: 'Sanitation Division East, MCD',
      deadline: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      status: 'in_progress',
      notes: 'Water misting truck scheduled for twice-daily runs between 7 AM and 3 PM.',
      verification_method: 'GPS track logs from water tanker and hourly CAAQMS PM10 trend comparison.',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      completed_at: null
    },
    {
      id: 'int-init-2',
      locality: 'Vasant Vihar, Delhi',
      role: 'school',
      title: 'Shift Morning Physical Assembly to Indoor Auditorium',
      timeframe: 'immediate',
      rationale: 'AQI exceeding 220 (Poor) during morning inversion peak (7:30 - 9:00 AM).',
      evidence: 'Morning particulate peak recorded at 245 AQI; health advisory for pediatric respiratory protection.',
      assigned_to: 'Vice Principal & Sports Director',
      deadline: new Date().toISOString().slice(0, 10),
      status: 'completed',
      notes: 'Indoor air purifiers operating in gym and auditorium; sports sessions postponed to post-noon.',
      verification_method: 'Daily log verified by school administration; parent notification dispatched.',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      completed_at: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ],
  aqi_history: [
    {
      id: 'hist-delhi-baseline',
      locality: 'Central Delhi',
      latitude: 28.6139,
      longitude: 77.2090,
      aqi: 260,
      category: 'Poor',
      pm25: 110,
      pm10: 220,
      station_name: 'Mandir Marg CAAQMS',
      station_distance_km: 2.8,
      recorded_at: new Date(Date.now() - 86400000 * 7).toISOString()
    }
  ],
  datasets: []
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadDB() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(DB_FILE)) {
    saveDB(INITIAL_DB);
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB, re-initializing:', err.message);
    saveDB(INITIAL_DB);
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
}

function saveDB(data) {
  ensureDir(DATA_DIR);
  const tempPath = `${DB_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_FILE);
}

// Database helper functions
const db = {
  // Citizen Reports
  getCitizenReports: (filter = {}) => {
    const state = loadDB();
    let reports = state.citizen_reports || [];
    if (filter.locality) {
      reports = reports.filter(r => r.locality.toLowerCase().includes(filter.locality.toLowerCase()));
    }
    return reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  addCitizenReport: (report) => {
    const state = loadDB();
    const id = 'cr-' + crypto.randomUUID().slice(0, 8);
    const newReport = {
      id,
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
      locality: String(report.locality || 'Unknown Locality'),
      report_type: String(report.report_type || 'other'),
      severity: String(report.severity || 'moderate'),
      description: String(report.description || '').slice(0, 1000),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    state.citizen_reports = state.citizen_reports || [];
    state.citizen_reports.unshift(newReport);
    saveDB(state);
    return newReport;
  },

  // Interventions
  getInterventions: (filter = {}) => {
    const state = loadDB();
    let list = state.interventions || [];
    if (filter.role) {
      list = list.filter(i => i.role === filter.role);
    }
    if (filter.status) {
      list = list.filter(i => i.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  addIntervention: (intv) => {
    const state = loadDB();
    const id = 'int-' + crypto.randomUUID().slice(0, 8);
    const item = {
      id,
      locality: String(intv.locality || 'Locality'),
      role: String(intv.role || 'citizen'),
      title: String(intv.title || 'Untitled Intervention'),
      timeframe: String(intv.timeframe || 'immediate'),
      rationale: String(intv.rationale || ''),
      evidence: String(intv.evidence || ''),
      assigned_to: String(intv.assigned_to || 'Unassigned'),
      deadline: String(intv.deadline || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)),
      status: String(intv.status || 'proposed'),
      notes: String(intv.notes || ''),
      verification_method: String(intv.verification_method || ''),
      created_at: new Date().toISOString(),
      completed_at: intv.status === 'completed' ? new Date().toISOString() : null
    };
    state.interventions = state.interventions || [];
    state.interventions.unshift(item);
    saveDB(state);
    return item;
  },

  updateIntervention: (id, updates) => {
    const state = loadDB();
    state.interventions = state.interventions || [];
    const index = state.interventions.findIndex(i => i.id === id);
    if (index === -1) return null;

    const current = state.interventions[index];
    const updated = {
      ...current,
      ...updates,
      completed_at: updates.status === 'completed' && !current.completed_at ? new Date().toISOString() : current.completed_at
    };
    state.interventions[index] = updated;
    saveDB(state);
    return updated;
  },

  deleteIntervention: (id) => {
    const state = loadDB();
    state.interventions = state.interventions || [];
    const initialLen = state.interventions.length;
    state.interventions = state.interventions.filter(i => i.id !== id);
    saveDB(state);
    return state.interventions.length < initialLen;
  },

  // AQI History Snapshots
  recordAQISnapshot: (record) => {
    const state = loadDB();
    const id = 'snap-' + crypto.randomUUID().slice(0, 8);
    const item = {
      id,
      locality: record.locality,
      latitude: record.latitude,
      longitude: record.longitude,
      aqi: record.aqi,
      category: record.category,
      pm25: record.pm25,
      pm10: record.pm10,
      station_name: record.station_name,
      station_distance_km: record.station_distance_km,
      recorded_at: new Date().toISOString()
    };
    state.aqi_history = state.aqi_history || [];
    state.aqi_history.unshift(item);
    // Keep max 100 history items
    if (state.aqi_history.length > 100) state.aqi_history = state.aqi_history.slice(0, 100);
    saveDB(state);
    return item;
  },

  getAQIHistory: (locality) => {
    const state = loadDB();
    let hist = state.aqi_history || [];
    if (locality) {
      hist = hist.filter(h => h.locality.toLowerCase().includes(locality.toLowerCase()));
    }
    return hist;
  },

  // Uploaded Datasets
  recordDataset: (dataset) => {
    const state = loadDB();
    state.datasets = state.datasets || [];
    state.datasets.unshift(dataset);
    saveDB(state);
    return dataset;
  },

  getDatasets: () => {
    const state = loadDB();
    return state.datasets || [];
  }
};

module.exports = db;
