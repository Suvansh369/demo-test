require('dotenv').config(); // MUST BE LINE 1

const express = require('express');
const path = require('path');
const { configureHelmet, configureCors, generalLimiter } = require('./backend/middleware/security');
const errorHandler = require('./backend/middleware/errorHandler');
const { callGemini, getActiveModel } = require('./backend/geminiService');
const supabase = require('./backend/supabase');

const authRoutes = require('./backend/routes/authRoutes');
const geoRoutes = require('./backend/routes/geoRoutes');
const analyzeRoutes = require('./backend/routes/analyzeRoutes');
const interventionRoutes = require('./backend/routes/interventionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware registered BEFORE mounting routes
app.use(configureHelmet());
app.use(configureCors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', generalLimiter);
app.use(express.static(path.join(__dirname, 'public')));

// Diagnostic Health Endpoint
app.get('/api/health', async (req, res) => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const key = rawKey.trim().replace(/^["']|["']$/g, '');
  const keyDetected = key.length > 0;
  const maskedKey = keyDetected ? key.slice(0, 6) + '...' + key.slice(-4) : null;

  let geminiStatus = { ok: false, error: null };
  if (keyDetected) {
    try {
      const ping = await callGemini('Ping NIRVAIR', false);
      geminiStatus = { ok: true, model: ping.model, source: ping.source };
    } catch (err) {
      geminiStatus = { ok: false, error: err.message };
    }
  }

  let openMeteoStatus = { ok: false, status: null };
  try {
    const omRes = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.61&longitude=77.20&current=pm2_5', {
      headers: { 'User-Agent': 'NIRVAIR-Health/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    openMeteoStatus = { ok: omRes.ok, status: omRes.status };
  } catch (err) {
    openMeteoStatus = { ok: false, error: err.message };
  }

  let supabaseStatus = { configured: !!process.env.SUPABASE_URL };
  try {
    const sb = await supabase.checkConnection();
    supabaseStatus = { ...supabaseStatus, ...sb };
  } catch (sbErr) {
    supabaseStatus = { ...supabaseStatus, connected: false, error: sbErr.message };
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    apiKey: { detected: keyDetected, masked: maskedKey },
    gemini: geminiStatus,
    openMeteo: openMeteoStatus,
    supabase: supabaseStatus
  });
});

// Modular Route Mounting
app.use('/api/auth', authRoutes);
app.use('/api', geoRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/gemini', analyzeRoutes);
app.use('/api/interventions', interventionRoutes);

// SPA Fallback & Centralized JSON Error Handler
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(` NIRVAIR Civic Air Intelligence Platform`);
    console.log(` Server active on http://localhost:${PORT}`);
    console.log(` Active Gemini Model: ${getActiveModel()}`);
    console.log(` Supabase Cloud DB: ${process.env.SUPABASE_URL || 'Configured'}`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
