const config = require('./config');
const { createApp } = require('./app');

async function start() {
  const app = await createApp();
  app.listen(config.port, () => {
    console.log(`Presence API listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
