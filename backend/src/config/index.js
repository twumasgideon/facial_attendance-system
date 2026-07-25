require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/presence',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@presence.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!',
  nodeEnv: process.env.NODE_ENV || 'development',
};
