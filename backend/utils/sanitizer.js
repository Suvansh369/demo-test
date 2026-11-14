/**
 * Security Sanitization Utilities for NIRVAIR
 * Defends against prompt injection, control character tampering, and malicious script inputs.
 */

/**
 * Sanitizes generic user-supplied text destined for LLM prompts.
 * Strips control characters, XML/HTML brackets, triple backticks, and prompt injection signatures.
 *
 * @param {string} input - Raw user input string
 * @param {number} maxLength - Maximum allowable length (default: 150)
 * @returns {string} Sanitized string
 */
function sanitizePromptInput(input, maxLength = 150) {
  if (input === null || input === undefined) return '';
  let str = String(input);

  // 1. Remove ASCII control characters and non-printable bytes
  str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

  // 2. Remove XML/HTML tag markers and triple backticks to prevent prompt breakout
  str = str.replace(/[<>]/g, '');
  str = str.replace(/```/g, '');

  // 3. Strip well-known prompt injection override phrases (case-insensitive)
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    /disregard\s+(all\s+)?(previous|prior|rules|instructions?)/gi,
    /system\s*prompt/gi,
    /you\s+are\s+now\s+/gi,
    /jailbreak/gi,
    /new\s+role/gi,
    /developer\s+mode/gi
  ];

  for (const pattern of injectionPatterns) {
    str = str.replace(pattern, '[REDACTED]');
  }

  // 4. Collapse multiple whitespaces and trim
  str = str.replace(/\s+/g, ' ').trim();

  // 5. Enforce length cap
  if (maxLength && str.length > maxLength) {
    str = str.slice(0, maxLength).trim();
  }

  return str;
}

/**
 * Strict sanitizer for locality and geographical location names.
 * Applies an allowlist of alphanumeric characters, whitespace, and basic punctuation (, . - ()).
 *
 * @param {string} locality - Locality name
 * @param {number} maxLength - Maximum length (default: 100)
 * @returns {string} Sanitized locality
 */
function sanitizeLocality(locality, maxLength = 100) {
  if (!locality) return 'Unknown Locality';
  let str = sanitizePromptInput(locality, maxLength);
  // Strict allowlist: letters, numbers, spaces, commas, periods, hyphens, and parentheses
  str = str.replace(/[^a-zA-Z0-9\s,.\-()]/g, '');
  str = str.replace(/\s+/g, ' ').trim();
  return str.slice(0, maxLength) || 'Selected Area';
}

module.exports = {
  sanitizePromptInput,
  sanitizeLocality
};
