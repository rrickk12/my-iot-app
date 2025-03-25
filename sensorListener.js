// sensorListener.js
const express = require('express');
const { insertReading } = require('./db/storage');

function startSensorListener() {
  const app = express();
  const PORT = 5000;

  app.use(express.json());

  // 🔁 In-memory cache to prevent duplicate storage
  const recentCache = new Map();

  function isDuplicate(mac, timestamp) {
    const key = `${mac}-${timestamp}`;
    if (recentCache.has(key)) return true;
    recentCache.set(key, true);
    setTimeout(() => recentCache.delete(key), 30 * 1000); // Keep for 30s
    return false;
  }

  app.post('/data', async (req, res) => {
    const payload = req.body;
    if (!Array.isArray(payload)) return res.status(400).json({ error: "Expected an array" });

    console.log(`📦 Received POST with ${payload.length} items`);

    for (const item of payload) {
      if (item.type === 'MST01' && item.mac && item.temperature !== undefined && item.humidity !== undefined) {
        const ts = new Date(item.timestamp).getTime();

        if (isDuplicate(item.mac, ts)) {
          console.log(`⏩ Skipped duplicate: ${item.mac} @ ${item.timestamp}`);
          continue;
        }

        try {
          await insertReading({
            sensorId: item.mac,
            timestamp: ts,
            temperature: item.temperature,
            humidity: item.humidity,
            rawHex: null
          });

          console.log(`✅ Stored: ${item.mac} | ${item.temperature}°C | ${item.humidity}%`);
        } catch (err) {
          console.error(`❌ Failed to insert ${item.mac}:`, err.message);
        }
      }
    }

    res.json({ status: 'ok' });
  });

  app.listen(PORT, () => {
    console.log(`📡 Sensor listener running at http://localhost:${PORT}/data`);
  });
}

module.exports = startSensorListener;
