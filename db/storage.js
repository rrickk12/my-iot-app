const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'sensors.db'));

/* Helper functions to promisify sqlite3 methods */
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // Contains this.lastID, changes, etc.
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/* CRUD & Sensor functions */

// Insert a new reading
async function insertReading({ sensorId, timestamp, temperature, humidity, rawHex = null }) {
  const sql = `
    INSERT INTO sensor_readings (sensorId, timestamp, temperature, humidity, rawHex)
    VALUES (?, ?, ?, ?, ?)
  `;
  const result = await runQuery(sql, [sensorId, timestamp, temperature, humidity, rawHex]);
  return result.lastID;
}

// Get summary per device (latest reading + averages)
async function getSummaryPerDevice() {
  const sql = `
    SELECT 
      sr1.sensorId,
      MAX(sr1.timestamp) as latestTimestamp,
      (SELECT temperature FROM sensor_readings sr2 
        WHERE sr2.sensorId = sr1.sensorId 
        ORDER BY timestamp DESC LIMIT 1) as latestTemp,
      (SELECT humidity FROM sensor_readings sr2 
        WHERE sr2.sensorId = sr1.sensorId 
        ORDER BY timestamp DESC LIMIT 1) as latestHum,
      ROUND(AVG(sr1.temperature), 2) as avgTemp,
      ROUND(AVG(sr1.humidity), 2) as avgHum,
      sm.name as sensorName
    FROM sensor_readings sr1
    LEFT JOIN sensor_metadata sm ON sr1.sensorId = sm.sensorId
    GROUP BY sr1.sensorId
  `;
  const rows = await allQuery(sql);
  return rows.map(row => ({
    sensorId: row.sensorId,
    sensorName: row.sensorName,
    latest: {
      timestamp: row.latestTimestamp,
      temperature: row.latestTemp,
      humidity: row.latestHum
    },
    mean: {
      temperature: row.avgTemp,
      humidity: row.avgHum
    }
  }));
}

// Get full history for a specific sensor
async function getSensorHistory(sensorId, limit = 500) {
  const sql = `
    SELECT timestamp, temperature, humidity
    FROM sensor_readings
    WHERE sensorId = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `;
  return await allQuery(sql, [sensorId, limit]);
}

// Set or update a sensor's name
async function setSensorName(sensorId, name) {
  const sql = `
    INSERT INTO sensor_metadata (sensorId, name)
    VALUES (?, ?)
    ON CONFLICT(sensorId) DO UPDATE SET name = excluded.name
  `;
  await runQuery(sql, [sensorId, name]);
  return true;
}

// Get all sensor names
async function getAllSensorNames() {
  const sql = `SELECT sensorId, name FROM sensor_metadata`;
  return await allQuery(sql);
}

// Get recent readings (limit optional)
async function getRecentReadings(limit = 50) {
  const sql = `
    SELECT sr.sensorId, sr.timestamp, sr.temperature, sr.humidity, sm.name as sensorName
    FROM sensor_readings sr
    LEFT JOIN sensor_metadata sm ON sr.sensorId = sm.sensorId
    ORDER BY sr.timestamp DESC
    LIMIT ?
  `;
  return await allQuery(sql, [limit]);
}

/* Aggregation Functions */

// Convert a time frame (e.g., "5m", "1h") into milliseconds
function timeFrameToMilliseconds(timeFrame) {
  if (timeFrame.endsWith('m')) {
    return parseInt(timeFrame) * 60 * 1000;
  } else if (timeFrame.endsWith('h')) {
    return parseInt(timeFrame) * 60 * 60 * 1000;
  }
  throw new Error("Unsupported time frame");
}

// Aggregate sensor data using a sliding window approach
async function aggregateSensorData(sensorId, timeFrame) {
  const ms = timeFrameToMilliseconds(timeFrame);
  const now = Date.now();
  const startTime = new Date(now - ms).toISOString();
  const sql = `
    SELECT timestamp, temperature, humidity
    FROM sensor_readings
    WHERE sensorId = ? AND timestamp >= ?
    ORDER BY timestamp DESC
  `;
  const rows = await allQuery(sql, [sensorId, startTime]);
  if (!rows.length) return null;
  const lastReading = rows[0];
  const avgTemp = rows.reduce((sum, r) => sum + r.temperature, 0) / rows.length;
  const avgHum = rows.reduce((sum, r) => sum + r.humidity, 0) / rows.length;
  const aggregationTime = new Date().toISOString();
  const insertSql = `
    INSERT INTO sensor_aggregated_data
      (sensorId, timeFrame, lastTimestamp, lastTemperature, lastHumidity, meanTemperature, meanHumidity, aggregationTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await runQuery(insertSql, [
    sensorId,
    timeFrame,
    lastReading.timestamp,
    lastReading.temperature,
    lastReading.humidity,
    avgTemp,
    avgHum,
    aggregationTime
  ]);
  return {
    sensorId,
    timeFrame,
    lastReading,
    avgTemperature: avgTemp,
    avgHumidity: avgHum,
    aggregationTime
  };
}

// Get last aggregated timestamp (checkpoint) for a sensor
async function getLastAggregatedAt(sensorId) {
  const sql = `
    SELECT lastAggregatedAt FROM aggregator_state WHERE sensorId = ?
  `;
  const row = await getQuery(sql, [sensorId]);
  return row ? row.lastAggregatedAt : null;
}

// Update the last aggregated timestamp for a sensor
async function updateLastAggregatedAt(sensorId, dateTime) {
  const sql = `
    INSERT INTO aggregator_state (sensorId, lastAggregatedAt)
    VALUES (?, ?)
    ON CONFLICT(sensorId) DO UPDATE SET lastAggregatedAt = excluded.lastAggregatedAt
  `;
  await runQuery(sql, [sensorId, dateTime]);
  return true;
}

// Aggregate sensor data using checkpoint logic
// In your storage module (e.g., storage.js)

async function aggregateSensorDataCheckpoint(sensorId, selectedTimeFrame = 'checkpoint') {
  try {
    // 1. Get the last aggregated checkpoint
    const lastAgg = await getLastAggregatedAt(sensorId);
    let startTime = !lastAgg
      ? '1970-01-01T00:00:00Z'
      : new Date(new Date(lastAgg).getTime() + 1000).toISOString();

    // 2. Fetch readings between the last checkpoint and now
    const now = new Date().toISOString();
    const sql = `
      SELECT timestamp, temperature, humidity
      FROM sensor_readings
      WHERE sensorId = ? AND timestamp > ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `;
    const rows = await allQuery(sql, [sensorId, startTime, now]);

    if (!rows.length) {
      // If there are no new readings, fetch the last reading
      const lastRead = await getQuery(
        `SELECT timestamp, temperature, humidity
         FROM sensor_readings
         WHERE sensorId = ?
         ORDER BY timestamp DESC LIMIT 1`,
        [sensorId]
      );
      
      // Update the checkpoint even if there are no new readings
      await updateLastAggregatedAt(sensorId, now);
      
      // If a last reading exists, insert a duplicate record to mark the period
      if (lastRead) {
        const insertSql = `
          INSERT INTO sensor_aggregated_data
            (sensorId, timeFrame, lastTimestamp, lastTemperature, lastHumidity, meanTemperature, meanHumidity, aggregationTime)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await runQuery(insertSql, [
          sensorId,
          selectedTimeFrame,
          lastRead.timestamp,
          lastRead.temperature,
          lastRead.humidity,
          lastRead.temperature,
          lastRead.humidity,
          now
        ]);
        return { sensorId, message: 'Nenhuma leitura nova; registro duplicado inserido.', timeFrame: selectedTimeFrame };
      } else {
        return { sensorId, message: 'Nenhuma leitura nova', timeFrame: selectedTimeFrame };
      }
    }

    // 3. Calculate averages and get the last reading (ordered ascending)
    const lastReading = rows[rows.length - 1];
    const avgTemp = rows.reduce((sum, r) => sum + r.temperature, 0) / rows.length;
    const avgHum = rows.reduce((sum, r) => sum + r.humidity, 0) / rows.length;

    // 4. Insert the aggregated result, storing the selected time frame
    const aggregationTime = new Date().toISOString();
    const insertSql = `
      INSERT INTO sensor_aggregated_data
        (sensorId, timeFrame, lastTimestamp, lastTemperature, lastHumidity, meanTemperature, meanHumidity, aggregationTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(insertSql, [
      sensorId,
      selectedTimeFrame,
      lastReading.timestamp,
      lastReading.temperature,
      lastReading.humidity,
      avgTemp,
      avgHum,
      aggregationTime
    ]);

    // 5. Update the checkpoint to now
    await updateLastAggregatedAt(sensorId, now);

    return {
      sensorId,
      lastReading,
      avgTemperature: avgTemp,
      avgHumidity: avgHum,
      aggregationTime,
      timeFrame: selectedTimeFrame
    };
  } catch (err) {
    throw err;
  }
}



module.exports = {
  insertReading,
  getRecentReadings,
  getSummaryPerDevice,
  getSensorHistory,
  setSensorName,
  getAllSensorNames,
  aggregateSensorData,
  aggregateSensorDataCheckpoint,
  db
};
