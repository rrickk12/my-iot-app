// network/ingest.js
const express = require('express');
const { insertReading } = require('../db/storage');
const router = express.Router();

router.post('/ingest', async (req, res) => {
  const data = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Expected array of data objects.' });
  }

  for (const item of data) {
    if (
      item.type === 'MST01' &&
      item.mac &&
      item.temperature !== undefined &&
      item.humidity !== undefined
    ) {
      try {
        await insertReading({
          sensorId: item.mac,
          timestamp: new Date(item.timestamp).getTime(),
          temperature: item.temperature,
          humidity: item.humidity,
          rawHex: null
        });

        console.log(`📥 Ingested: ${item.mac} | ${item.temperature}°C | ${item.humidity}%`);
      } catch (err) {
        console.error(`❌ Failed to insert ${item.mac}:`, err.message);
      }
    }
  }

  res.json({ status: 'ok' });
});

module.exports = router;
