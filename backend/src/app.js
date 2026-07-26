const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { connectDb } = require('./config/db');
const { fail } = require('./utils/response');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const attendanceRoutes = require('./routes/attendance');
const employeeRoutes = require('./routes/employees');
const { seedIfEmpty } = require('./utils/seedData');

async function createApp() {
  await connectDb();
  await seedIfEmpty();

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '8mb' }));
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'presence-api',
        version: '1.0.0',
        docs: '/api/v1',
        health: '/health',
      },
    });
  });

  app.get('/api/v1', (_req, res) => {
    res.json({
      success: true,
      data: {
        endpoints: [
          'POST /api/v1/auth/login',
          'GET /api/v1/auth/me',
          'POST /api/v1/devices/register',
          'POST /api/v1/branches',
          'GET /api/v1/branches',
          'POST /api/v1/employees',
          'PUT /api/v1/employees/:employeeId',
          'DELETE /api/v1/employees/:employeeId',
          'POST /api/v1/attendance',
          'GET /api/v1/employees/sync',
        ],
      },
    });
  });

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'presence-api',
        status: 'ok',
        time: new Date().toISOString(),
      },
    });
  });

  const branchRoutes = require('./routes/branches');

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/devices', deviceRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/employees', employeeRoutes);
  app.use('/api/v1/branches', branchRoutes);

  app.use((_req, res) => fail(res, 'Not found', 404));

  app.use((err, _req, res, _next) => {
    console.error(err);
    return fail(res, err.message || 'Internal server error', err.status || 500);
  });

  return app;
}

module.exports = { createApp };
