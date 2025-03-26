// index.js
const express = require('express');
const path = require('path');
const http = require('http');
const { config, getFullUrl } = require('./config');
const { getRecentReadings } = require('./db/storage');

const app = express();
const server = http.createServer(app);

const apiRoutes = require('./network/api');
const ingestRoute = require('./network/ingest');
const startSensorListener = require('./sensorListener');

app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api', ingestRoute);
app.use('/', express.static(path.join(__dirname, 'public')));

console.log("🌐 API URL:", getFullUrl('api'));
console.log("🔎 Ready to receive BLE data at http://localhost:5000/data");

server.listen(config.apiPort || 3000, () => {
  console.log(`🚀 Main server running at http://localhost:${config.apiPort || 3000}`);
});

// Start listener on port 5000
startSensorListener();
