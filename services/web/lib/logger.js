// Minimal structured logger wrapper for services/web
// Usage: const logger = require('./logger'); logger.info('token.create', { userId, resourceId, ... });

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch (e) { return String(obj); }
}

function log(level, event, meta = {}) {
  const record = Object.assign({ event, service: 'web', level, timestamp: new Date().toISOString() }, meta);
  // ensure JSON output on one line
  console.log(safeStringify(record));
}

module.exports = {
  info: (event, meta) => log('info', event, meta),
  warn: (event, meta) => log('warn', event, meta),
  error: (event, meta) => log('error', event, meta),
};
