/**
 * Authentication Routes for NIRVAIR Evaluator Gateway
 * Implements demo authentication with credentials:
 * Username: PromtWars (exact spelling)
 * Password: google
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const VALID_USERNAME = 'PromtWars';
const VALID_PASSWORD = 'google';

/**
 * POST /api/auth/login
 * Validates evaluator credentials and generates a secure session token
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required.'
    });
  }

  // Exact validation matching specification
  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
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
