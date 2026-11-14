/**
 * Centralized JSON Error Handler Middleware for NIRVAIR
 * Traps errors uniformly and provides structured, clean JSON responses.
 */

function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message || err);

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size limit exceeded. Maximum file upload size is 10MB.'
    });
  }

  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.',
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
