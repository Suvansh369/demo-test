/**
 * Secure Multer Upload Middleware for NIRVAIR
 * Enforces memory storage, 10MB file size ceiling, and strict extension checks.
 */

const multer = require('multer');
const { fileFilter } = require('./security');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB ceiling
  fileFilter: fileFilter
});

module.exports = upload;
