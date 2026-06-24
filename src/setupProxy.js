const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * For local dev, forward these paths to Express so relative URLs still work if env is missing.
 * Multipart POST /incidents must not be handled by the CRA dev server (it returns "Cannot POST /incidents").
 */
module.exports = function setupProxy(app) {
  const target = 'https://127.0.0.1:5000';
  const opts = { target, changeOrigin: true, secure: false };
  /** Ensures /api/* (e.g. /api/forecast) hits Express; package.json "proxy" alone can miss some paths. */
  app.use('/api', createProxyMiddleware(opts));
  app.use('/auth', createProxyMiddleware(opts));
  app.use('/slots', createProxyMiddleware(opts));
  app.use('/reservations', createProxyMiddleware(opts));
  app.use('/gate', createProxyMiddleware(opts));
  app.use('/admin', createProxyMiddleware(opts));
  app.use('/paymob', createProxyMiddleware(opts));
  app.use('/incidents', createProxyMiddleware(opts));
  app.use('/uploads', createProxyMiddleware(opts));
  app.use('/health', createProxyMiddleware(opts));
};
