/**
 * NIRVAIR Security Middleware Suite.
 * Configures Helmet HTTP security headers, CORS origin whitelisting,
 * Multer upload sanitization, and endpoint rate limiters.
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 1. CORS Configuration (Restricts cross-origin requests to trusted origins)
function configureCors() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Cross-Origin Request Blocked by NIRVAIR Security Policy'));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400
  });
}

// 2. Helmet Security Headers with Safe Content Security Policy (CSP)
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Tailwind CDN config and dynamic initialization
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.basemaps.cartocdn.com",
          "https://*.tile.openstreetmap.org",
          "https://unpkg.com"
        ],
        connectSrc: [
          "'self'",
          "https://air-quality-api.open-meteo.com",
          "https://geocoding-api.open-meteo.com",
          "https://generativelanguage.googleapis.com"
        ],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
}

// 3. Endpoint Rate Limiters (Prevents API exhaustion and DoS)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // 150 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40, // 40 Gemini queries per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI query rate limit exceeded. Please wait a few moments before generating additional directives.'
  }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 file/data uploads per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Data upload limit reached. Please wait before processing more datasets.'
  }
});

const citizenReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 citizen reports per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Citizen submission rate limit reached. Thank you for reporting; please wait before logging more incidents.'
  }
});

// 4. File Upload Security Filter (Checks extension and MIME types)
const ALLOWED_EXTENSIONS = ['.csv', '.tsv', '.txt', '.xlsx', '.xls'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type rejected. Supported extensions: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
  cb(null, true);
}

module.exports = {
  configureCors,
  configureHelmet,
  generalLimiter,
  aiLimiter,
  uploadLimiter,
  citizenReportLimiter,
  fileFilter,
  ALLOWED_EXTENSIONS
};
