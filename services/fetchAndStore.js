const express = require('express');
const router = express.Router();

// Import functions and the database connection from storage module
const { 
  db,
  insertReading,
  getRecentReadings,
  getSummaryPerDevice,
  getSensorHistory,
  setSensorName,
  getAllSensorNames,
  aggregateSensorDataCheckpoint,
  aggregateSensorData
} = require('../db/storage');

/* Helper: promisify db.all for the export endpoint */
function allQueryDB(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/* Routes */

// GET /api/readings - Retrieve recent sensor readings
router.get('/readings', async (req, res) => {
  try {
    const data = await getRecentReadings();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/devices/summary - Retrieve sensor summary
router.get('/devices/summary', async (req, res) => {
  try {
    const summary = await getSummaryPerDevice();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Summary error', details: err.message });
  }
});

// GET /api/devices/:sensorId/history - Retrieve full history for a sensor
router.get('/devices/:sensorId/history', async (req, res) => {
  const { sensorId } = req.params;
  const limit = parseInt(req.query.limit) || 300;
  try {
    const history = await getSensorHistory(sensorId, limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'History fetch error', details: err.message });
  }
});

// POST /api/devices/:sensorId/name - Update sensor name (option 1)
router.post('/devices/:sensorId/name', async (req, res) => {
  const { sensorId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    await setSensorName(sensorId, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set name', details: err.message });
  }
});

// GET /api/devices/names - List all sensor names (option 1)
router.get('/devices/names', async (req, res) => {
  try {
    const names = await getAllSensorNames();
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch names', details: err.message });
  }
});

// GET /api/sensors/names - List all sensor names (option 2; consider consolidating with the above)
router.get('/sensors/names', async (req, res) => {
  try {
    const names = await getAllSensorNames();
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch names', details: err.message });
  }
});

// POST /api/sensors/:sensorId/name - Update sensor name (option 2; consider consolidating)
router.post('/sensors/:sensorId/name', async (req, res) => {
  const { sensorId } = req.params;
  const { name } = req.body;
  if (!name || !sensorId) return res.status(400).json({ error: 'Missing name or sensorId' });
  try {
    await setSensorName(sensorId, name);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save name', details: err.message });
  }
});

// GET /api/aggregates/export - Export aggregated sensor data as CSV
router.get('/aggregates/export', async (req, res) => {
  const { startDate, endDate } = req.query;
  const sql = `
    SELECT * FROM sensor_aggregated_data 
    WHERE aggregationTime BETWEEN ? AND ?
  `;
  try {
    const rows = await allQueryDB(sql, [startDate, endDate]);

    // Build CSV string
    let csv = 'sensorId,timeFrame,lastTimestamp,lastTemperature,lastHumidity,meanTemperature,meanHumidity,aggregationTime\n';
    rows.forEach(row => {
      csv += `${row.sensorId},${row.timeFrame},${row.lastTimestamp},${row.lastTemperature},${row.lastHumidity},${row.meanTemperature},${row.meanHumidity},${row.aggregationTime}\n`;
    });

    // Set no-cache headers
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");

    res.header("Content-Type", "text/csv");
    res.attachment("export.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

// GET /api/aggregates/trigger - Trigger sensor data aggregation
router.get('/aggregates/trigger', async (req, res) => {
  const { sensorId } = req.query;
  try {
    if (sensorId) {
      const result = await aggregateSensorDataCheckpoint(sensorId);
      return res.json(result);
    } else {
      // Aggregate for all sensors
      const sensors = await getAllSensorNames();
      const results = [];
      for (const s of sensors) {
        const aggResult = await aggregateSensorDataCheckpoint(s.sensorId);
        results.push(aggResult);
      }
      return res.json(results);
    }
  } catch (err) {
    console.error("Aggregation error:", err);
    return res.status(500).json({ error: "Aggregation failed", details: err.message });
  }
});

module.exports = router;
