/**
 * Supabase Database Client for NIRVAIR
 * Project URL: https://ymfyrxojlxxycjqdmixb.supabase.co
 * Provides cloud database persistence for citizen reports, interventions,
 * AQI history snapshots, and analyzed datasets with automatic local fallback.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ymfyrxojlxxycjqdmixb.supabase.co').trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_kSO6O6tR7Io8iOjoVNgklw_6JhW6wjL').trim();

let supabase = null;
let isConnected = null;

try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  }
} catch (err) {
  console.warn('Supabase client initialization notice:', err.message);
}

/**
 * Checks if Supabase client is configured and tables are reachable
 */
async function checkConnection() {
  if (!supabase) return { connected: false, error: 'Supabase credentials not configured' };
  try {
    const { data, error } = await supabase.from('citizen_reports').select('id').limit(1);
    if (error) {
      return { connected: false, code: error.code, message: error.message };
    }
    isConnected = true;
    return { connected: true, tablesReady: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

const supabaseService = {
  client: supabase,
  checkConnection,

  // Citizen Reports
  async getCitizenReports(filter = {}) {
    if (!supabase) return null;
    try {
      let query = supabase.from('citizen_reports').select('*').order('timestamp', { ascending: false });
      if (filter.locality) {
        query = query.ilike('locality', `%${filter.locality}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  async addCitizenReport(report) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('citizen_reports').insert([report]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  // Interventions
  async getInterventions(filter = {}) {
    if (!supabase) return null;
    try {
      let query = supabase.from('interventions').select('*').order('created_at', { ascending: false });
      if (filter.role) {
        query = query.eq('role', filter.role);
      }
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  async addIntervention(item) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('interventions').insert([item]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  async updateIntervention(id, updates) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('interventions').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  async deleteIntervention(id) {
    if (!supabase) return null;
    try {
      const { error } = await supabase.from('interventions').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      return null;
    }
  },

  // AQI History
  async recordAQISnapshot(snapshot) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('aqi_history').insert([snapshot]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  async getAQIHistory(locality) {
    if (!supabase) return null;
    try {
      let query = supabase.from('aqi_history').select('*').order('recorded_at', { ascending: false }).limit(100);
      if (locality) {
        query = query.ilike('locality', `%${locality}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  // Datasets
  async recordDataset(dataset) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('datasets').insert([{
        id: dataset.id,
        file_name: dataset.fileName,
        total_records: dataset.totalRecords,
        analyzed_parameter: dataset.analyzedParameter,
        trust_breakdown: dataset.trustBreakdown,
        uploaded_at: dataset.uploadedAt
      }]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  async getDatasets() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('datasets').select('*').order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data.map(d => ({
        id: d.id,
        fileName: d.file_name,
        totalRecords: d.total_records,
        analyzedParameter: d.analyzed_parameter,
        trustBreakdown: d.trust_breakdown,
        uploadedAt: d.uploaded_at
      }));
    } catch (err) {
      return null;
    }
  }
};

module.exports = supabaseService;
