const mongoose = require('mongoose');
const config = require('./index');

let memoryServer;
let connecting;

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    mongoose.set('strictQuery', true);

    let uri = config.mongoUri;

    if (process.env.USE_MEMORY_DB === 'true') {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri('presence');
      console.log('Using in-memory MongoDB (set USE_MEMORY_DB=false for real MongoDB)');
    }

    if (!uri) {
      throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(uri);
    console.log('MongoDB connected');
    return mongoose.connection;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

async function stopDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDb, stopDb };
