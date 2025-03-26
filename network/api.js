const express = require('express');
const router = express.Router();

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

// 📥 Recent sensor readings
router.get('/readings', async (req, res) => {
  try {
    const data = await getRecentReadings();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// 📊 Sensor summary
router.get('/devices/summary', async (req, res) => {
  try {
    const summary = await getSummaryPerDevice();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Summary error', details: err.message });
  }
});

// 📈 Sensor history
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

// 📝 Update or assign a name to a sensor
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

// 📋 List all sensor names
router.get('/devices/names', async (req, res) => {
  try {
    const names = await getAllSensorNames();
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch names', details: err.message });
  }
});

// GET all sensor names (duplicate - consider consolidation)
router.get('/sensors/names', async (req, res) => {
  try {
    const names = await getAllSensorNames();
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch names', details: err.message });
  }
});

// POST / PUT sensor name (duplicate - consider consolidation)
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
  const { startDate, endDate, timeFrame } = req.query;
  
  // Convert to full ISO ranges
  const startDateISO = startDate ? startDate + "T00:00:00.000Z" : "1970-01-01T00:00:00.000Z";
  const endDateISO = endDate ? endDate + "T23:59:59.999Z" : new Date().toISOString();

  // Build SQL, optionally filtering by timeFrame if provided
  let sql = `
    SELECT * FROM sensor_aggregated_data 
    WHERE aggregationTime BETWEEN ? AND ?
  `;
  const params = [startDateISO, endDateISO];
  if (timeFrame) {
    sql += " AND timeFrame = ?";
    params.push(timeFrame);
  }
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Export failed', details: err.message });
    }
    
    let csv = 'sensorId,timeFrame,lastTimestamp,lastTemperature,lastHumidity,meanTemperature,meanHumidity,aggregationTime\n';
    rows.forEach(row => {
      csv += `${row.sensorId},${row.timeFrame},${row.lastTimestamp},${row.lastTemperature},${row.lastHumidity},${row.meanTemperature},${row.meanHumidity},${row.aggregationTime}\n`;
    });
    
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    res.header("Content-Type", "text/csv");
    res.attachment("export.csv");
    res.send(csv);
  });
});

// GET /api/aggregates/export-by-interval?startDate=2025-03-26&endDate=2025-03-26&interval=5
// where interval is in minutes (e.g. 5, 15, 60, etc.)
// GET /api/aggregates/export-by-interval?startDate=2025-03-26&endDate=2025-03-26&interval=5
// "interval" is the grouping period in minutes (e.g., 5, 15, 60, etc.)
router.get('/aggregates/export-by-interval', async (req, res) => {
  const { startDate, endDate, interval } = req.query;
  const groupInterval = parseInt(interval);
  if (isNaN(groupInterval)) {
    return res.status(400).json({ error: "Intervalo inválido" });
  }

  // Create full ISO date ranges for filtering
  const startDateISO = startDate ? startDate + "T00:00:00.000Z" : "1970-01-01T00:00:00.000Z";
  const endDateISO = endDate ? endDate + "T23:59:59.999Z" : new Date().toISOString();

  // Use SQLite's strftime to extract year-month-day and hour, and then compute the bucket of minutes.
  // The following expression groups minutes into intervals of the selected length.
  const sql = `
    SELECT 
      sr.sensorId,
      sm.name AS sensorName,
      strftime('%Y-%m-%dT%H:', sr.timestamp) ||
        printf('%02d', (CAST(strftime('%M', sr.timestamp) AS INTEGER) / ? ) * ? ) AS interval_start,
      MIN(sr.timestamp) AS bucketStart,
      MAX(sr.timestamp) AS bucketEnd,
      AVG(sr.temperature) AS meanTemperature,
      AVG(sr.humidity) AS meanHumidity,
      COUNT(*) AS readingsCount
    FROM sensor_readings sr
    LEFT JOIN sensor_metadata sm ON sr.sensorId = sm.sensorId
    WHERE sr.timestamp BETWEEN ? AND ?
    GROUP BY sr.sensorId, interval_start
    ORDER BY sr.sensorId, interval_start;
  `;

  // Wrap the db.all call in a Promise for async/await:
  const queryAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  try {
    const rows = await queryAll(sql, [groupInterval, groupInterval, startDateISO, endDateISO]);

    let csv = 'sensorId,sensorName,interval_start,bucketStart,bucketEnd,meanTemperature,meanHumidity,readingsCount,interval\n';
    rows.forEach(row => {
      csv += `${row.sensorId},${row.sensorName || row.sensorId},${row.interval_start},${row.bucketStart},${row.bucketEnd},${row.meanTemperature},${row.meanHumidity},${row.readingsCount},${groupInterval}m\n`;
    });

    // Set no-cache headers to force fresh download
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");

    res.header("Content-Type", "text/csv");
    res.attachment("export_by_interval.csv");
    res.send(csv);
  } catch (err) {
    console.error("Export by interval error:", err);
    res.status(500).json({ error: "Export by interval failed", details: err.message });
  }
});

router.get('/aggregates/trigger', async (req, res) => {
  const { sensorId, timeFrame } = req.query; // timeFrame is expected (e.g. "5m")
  try {
    if (sensorId) {
      const result = await aggregateSensorDataCheckpoint(sensorId, timeFrame);
      return res.json(result);
    } else {
      // Aggregate for all sensors
      const sensors = await getAllSensorNames();
      const results = [];
      for (const s of sensors) {
        const aggResult = await aggregateSensorDataCheckpoint(s.sensorId, timeFrame);
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
