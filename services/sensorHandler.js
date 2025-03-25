const { insertReading } = require('../db/storage');

// Temporary in-memory cache (you can replace with Redis later)
const recentPackets = new Set();

function getPacketHash(sensorId, timestamp) {
  return `${sensorId}-${timestamp}`;
}

function isDuplicate(sensorId, timestamp) {
  const key = getPacketHash(sensorId, timestamp);
  if (recentPackets.has(key)) return true;
  recentPackets.add(key);

  // Auto-clean memory after 5 mins
  setTimeout(() => recentPackets.delete(key), 5 * 60 * 1000);
  return false;
}

async function handleSensorPacket(data) {
  if (!Array.isArray(data)) return;

  for (const reading of data) {
    const {
      type,
      mac,
      timestamp,
      temperature,
      humidity
    } = reading;

    if (type !== 'MST01' || temperature == null || humidity == null) continue;
    if (isDuplicate(mac, timestamp)) {
      console.log(`⏩ Skipping duplicate reading from ${mac}`);
      continue;
    }

    try {
      await insertReading({
        sensorId: mac,
        timestamp,
        temperature,
        humidity,
        rawHex: null // not needed anymore
      });
    } catch (err) {
      console.error(`❌ DB Insert error for ${mac}:`, err.message);
    }
  }
}

module.exports = handleSensorPacket;
