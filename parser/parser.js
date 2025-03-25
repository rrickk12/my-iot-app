// parser/parser.js

function normalizeSensorId(id) {
  return (id || '').toLowerCase();
}

function parseIncomingItems(items = []) {
  const parsed = [];

  for (const item of items) {
    const { type, mac, timestamp } = item;
    const sensorId = normalizeSensorId(mac);

    // Accept only full MST01 readings
    if (type === 'MST01') {
      parsed.push({
        valid: true,
        source: 'post-mst01',
        format: 'json',
        sensorId,
        timestamp,
        temperature: item.temperature,
        humidity: item.humidity,
        rssi: item.rssi,
        raw: item
      });
    }
  }

  return parsed;
}

module.exports = {
  normalizeSensorId,
  parseIncomingItems
};
