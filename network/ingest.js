// services/fetchAndStore.js
const axios = require('axios');
const { insertReading } = require('../db/storage');

const SENSOR_ENDPOINT = 'http://192.168.15.11:5000/data';

async function fetchAndStoreSensorData() {
  try {
    const { data } = await axios.get(SENSOR_ENDPOINT);

    if (!Array.isArray(data)) {
      console.warn("❗ Formato inesperado da resposta do endpoint.");
      return;
    }

    // Process each data item concurrently
    await Promise.all(
      data.map(async (item) => {
        const { type, mac, temperature, humidity } = item;
        if (type === 'MST01' && temperature != null && humidity != null) {
          await insertReading({
            sensorId: mac,
            timestamp: new Date().toISOString(),
            temperature,
            humidity,
            rawHex: null
          });
          console.log(`✅ Stored: ${mac} | ${temperature} °C | ${humidity} %`);
        }
      })
    );
  } catch (err) {
    console.error("❌ Failed to fetch/store sensor data:", err.message);
  }
}

module.exports = fetchAndStoreSensorData;
