import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  name: process.env.APP_NAME || 'NestJS Blog API',

  port: parseInt(process.env.APP_PORT || process.env.PORT || '8080', 10),

  apiPrefix: process.env.API_PREFIX || 'api/v1',

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

  maintenanceMode: process.env.MAINTENANCE_MODE === 'true',

  passwordPepper: process.env.PASSWORD_PEPPER || '',

  // HMAC secret cho public view fingerprint.
  viewerKeySecret: process.env.VIEWER_KEY_SECRET || '',

  // Số reverse proxy đứng trước NestJS.
  trustProxyHops: Math.max(
    0,
    parseInt(process.env.TRUST_PROXY_HOPS || '0', 10) || 0,
  ),

  topPostsCandidateDays: Math.max(
    1,
    parseInt(process.env.TOP_POSTS_CANDIDATE_DAYS || '90', 10) || 90,
  ),

  topPostsCacheTtlSeconds: Math.max(
    1,
    parseInt(process.env.TOP_POSTS_CACHE_TTL_SECONDS || '120', 10) || 120,
  ),
}));
