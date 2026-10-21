// style-src-attr permite a largura das barras desenhadas pelo próprio aplicativo.
// Nenhum script, frame ou objeto externo entra na página.
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const PERMISSIONS_POLICY = 'camera=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=(), microphone=(self)';

module.exports = { APP_CSP, PERMISSIONS_POLICY };
