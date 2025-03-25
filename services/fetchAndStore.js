// services/fetchAndStore.js
const axios = require('axios');
const { insertReading } = require('../db/storage');

const SENSOR_ENDPOINT = 'http://192.168.15.11:5000/data';

async function fetchAndStoreSensorData() {
  try {
    const response = await axios.get(SENSOR_ENDPOINT);
    const data = response.data;

    if (!Array.isArray(data)) {
      console.warn("❗ Unexpected format from sensor endpoint.");
      return;
    }

    for (const item of data) {
      if (item.type === 'MST01' && item.temperature != null && item.humidity != null) {
        await insertReading({
          sensorId: item.mac,
          timestamp: new Date(item.timestamp).getTime(),
          temperature: item.temperature,
          humidity: item.humidity,
          rawHex: null
        });

        console.log(`✅ Stored: ${item.mac} | ${item.temperature} °C | ${item.humidity} %`);
      }
    }
  } catch (err) {
    console.error("❌ Failed to fetch/store sensor data:", err.message);
  }
}

module.exports = fetchAndStoreSensorData;
