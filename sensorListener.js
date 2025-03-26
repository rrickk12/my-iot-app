// sensorListener.js
const express = require('express');
const { insertReading } = require('./db/storage');

function startSensorListener() {
  const app = express();
  const PORT = 5000;

  app.use(express.json());

  // In-memory cache to prevent duplicate storage.
  // The key is a combination of the sensor MAC and a timestamp.
  const recentCache = new Map();

  /**
   * Check if a reading is a duplicate.
   * @param {string} mac - Sensor identifier.
   * @param {string} timestamp - ISO timestamp of the reading.
   * @returns {boolean} - true if duplicate.
   */
  function isDuplicate(mac, timestamp) {
    const key = `${mac}-${timestamp}`;
    if (recentCache.has(key)) return true;
    recentCache.set(key, true);
    // Remove key after 30 seconds.
    setTimeout(() => recentCache.delete(key), 30 * 1000);
    return false;
  }

  app.post('/data', async (req, res) => {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Expected an array" });
    }

    console.log(`📦 Received POST with ${payload.length} items`);

    for (const item of payload) {
      // Destructure the required properties from each item.
      const { type, mac, temperature, humidity } = item;
      // Process only if the type is 'MST01' and required fields exist.
      if (type === 'MST01' && mac && temperature !== undefined && humidity !== undefined) {
        // Use the sensor's provided timestamp if available; otherwise, use current time.
        const itemTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();
        const ts = itemTimestamp.toISOString();

        // Use the duplicate check based on MAC and timestamp.
        if (isDuplicate(mac, ts)) {
          console.log(`⏩ Skipped duplicate: ${mac} @ ${ts}`);
          continue;
        }

        try {
          await insertReading({
            sensorId: mac,
            timestamp: ts,
            temperature,
            humidity,
            rawHex: null
          });
          console.log(`✅ Stored: ${mac} | ${temperature}°C | ${humidity}%`);
        } catch (err) {
          console.error(`❌ Failed to insert ${mac}:`, err.message);
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
