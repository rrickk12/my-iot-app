const express = require('express');
const router = express.Router();

const {
  getRecentReadings,
  getSummaryPerDevice,
  getSensorHistory,
  setSensorName,
  getAllSensorNames
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

// GET all sensor names
router.get('/sensors/names', async (req, res) => {
  try {
    const names = await getAllSensorNames();
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch names', details: err.message });
  }
});

// POST / PUT sensor name
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


module.exports = router;
