const config = require('./config');
const { createApp } = require('./app');

function assertMongoConfig() {
  const uri = config.mongoUri || '';
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Set it in Render Environment.');
  }
  if (uri.includes('<db_password>') || uri.includes('<password>')) {
    throw new Error(
      'MONGODB_URI still contains <db_password>. Replace it with your real Atlas database user password.'
    );
  }
}

async function start() {
  assertMongoConfig();

  const app = await createApp();
  const host = process.env.HOST || '0.0.0.0';

  app.listen(config.port, host, () => {
    console.log(`Presence API listening on http://${host}:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message || err);
  process.exit(1);
});
