/**
 * Authentication Routes for NIRVAIR Evaluator Gateway
 * Implements demo authentication with credentials:
 * Username: PromtWars (exact spelling)
 * Password: google
 */

const express = require('express');
const crypto = require('crypto');
const { authLimiter } = require('../middleware/security');
const router = express.Router();

const VALID_USERNAME = 'PromtWars';
const VALID_PASSWORD = 'google';

/**
 * Constant-time string comparison to prevent timing analysis attacks
 */
function safeCompare(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const inputBuffer = Buffer.from(input, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

/**
 * POST /api/auth/login
 * Validates evaluator credentials with rate limiting and constant-time check
 */
router.post('/login', authLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required.'
    });
  }

  // Exact validation using timing-safe constant time comparison
  const isUserValid = safeCompare(String(username).trim(), VALID_USERNAME);
  const isPassValid = safeCompare(String(password).trim(), VALID_PASSWORD);

  if (isUserValid && isPassValid) {
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Also set an HTTP-only cookie for browser sessions
    res.cookie('nirvair_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      message: 'Authentication successful. Welcome to NIRVAIR Civic Intelligence.',
      token: sessionToken,
      user: {
        username: VALID_USERNAME,
        role: 'Evaluator / Municipal Analyst'
      }
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid credentials. Please use demo credentials: ID "PromtWars", Password "google".'
  });
});

/**
 * POST /api/auth/logout
 * Clears current session
 */
router.post('/logout', (req, res) => {
  res.clearCookie('nirvair_session');
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * GET /api/auth/status
 * Informs frontend of authentication status
 */
router.get('/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies ? req.cookies.nirvair_session : null;

  if (authHeader || cookieToken) {
    return res.json({
      authenticated: true,
      user: { username: VALID_USERNAME, role: 'Evaluator' }
    });
  }

  return res.json({
    authenticated: false
  });
});

module.exports = router;
