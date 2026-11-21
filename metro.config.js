
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable WebAssembly assets
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// Preserve existing Expo middleware
const existingMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, server) => {
  const enhancedMiddleware = existingMiddleware
    ? existingMiddleware(middleware, server)
    : middleware;

  return (req, res, next) => {
    res.setHeader(
      'Cross-Origin-Embedder-Policy',
      'credentialless'
    );

    res.setHeader(
      'Cross-Origin-Opener-Policy',
      'same-origin'
    );

    enhancedMiddleware(req, res, next);
  };
};

module.exports = config;
