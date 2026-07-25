const { createApp } = require('../src/app');

let appPromise;

module.exports = async (req, res) => {
  if (!appPromise) {
    appPromise = createApp();
  }

  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('API boot failed:', err);
    appPromise = null;
    res.status(500).json({
      success: false,
      message: err.message || 'Server failed to start',
    });
  }
};
