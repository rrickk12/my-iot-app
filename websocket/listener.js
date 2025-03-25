const WebSocket = require('ws');
const { config, getFullUrl } = require('../config');
const { parseMstPacket } = require('../parser/parser');
const { insertReading } = require('../db/storage');
const { broadcast } = require('./broadcast');

function startWebSocketListener() {
  const wsUrl = getFullUrl('websocket');

  console.log(`🛰️ Connecting to WebSocket at ${wsUrl}...`);

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log(`📡 Connected to WebSocket at ${wsUrl}`);
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      // console.log("📥 Message:", message);

      const packets = message.packets || [];
      for (const hex of packets) {
        const parsed = parseMstPacket(hex);

        if (parsed?.valid) {
          const reading = {
            sensorId: message.transmitterId || parsed.deviceId || parsed.bestCandidate?.hex,
            timestamp: message.timestamp || Date.now(),
            temperature: parsed.temperature,
            humidity: parsed.humidity,
            rawHex: parsed.rawHex,
          };

          await insertReading(reading);
          broadcast({ sensorId: reading.sensorId, reading });
          console.log(`✅ Saved ${reading.temperature}°C / ${reading.humidity ?? 'null'}% from ${reading.sensorId}`);
        }
      }
    } catch (err) {
      console.error("❌ Error parsing WebSocket data:", err.message);
    }
  });

  ws.on('close', () => {
    console.warn("🔌 WebSocket disconnected");
  });

  ws.on('error', (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
}

module.exports = startWebSocketListener;
