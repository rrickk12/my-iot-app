const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'sensors.db'));

// 🧪 Insert a new reading
function insertReading({ sensorId, timestamp, temperature, humidity, rawHex = null }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO sensor_readings (sensorId, timestamp, temperature, humidity, rawHex)
       VALUES (?, ?, ?, ?, ?)`,
      [sensorId, timestamp, temperature, humidity, rawHex],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// 📥 Get recent readings (limit optional)
const sql = `
  SELECT sr1.sensorId,
         MAX(sr1.timestamp) as latestTimestamp,
         (SELECT temperature FROM sensor_readings sr2 
          WHERE sr2.sensorId = sr1.sensorId 
          ORDER BY timestamp DESC LIMIT 1) as latestTemp,
         (SELECT humidity FROM sensor_readings sr2 
          WHERE sr2.sensorId = sr1.sensorId 
          ORDER BY timestamp DESC LIMIT 1) as latestHum,
         ROUND(AVG(sr1.temperature), 2) as avgTemp,
         ROUND(AVG(sr1.humidity), 2) as avgHum,
         sn.name as sensorName
  FROM sensor_readings sr1
  LEFT JOIN sensor_names sn ON sr1.sensorId = sn.sensorId
  GROUP BY sr1.sensorId
`;


// 📊 Get summary per device (latest + averages)
function getSummaryPerDevice() {
  return new Promise((resolve, reject) => {
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
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(row => ({
        sensorId: row.sensorId,
        latest: {
          timestamp: row.latestTimestamp,
          temperature: row.latestTemp,
          humidity: row.latestHum
        },
        mean: {
          temperature: row.avgTemp,
          humidity: row.avgHum
        }
      })));
    });
  });
}

// 📜 Get full history for a specific sensor
function getSensorHistory(sensorId, limit = 500) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT timestamp, temperature, humidity
      FROM sensor_readings
      WHERE sensorId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    db.all(sql, [sensorId, limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
// 📛 Set or update a custom name for a sensor
function setSensorName(sensorId, name) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO sensor_metadata (sensorId, name)
      VALUES (?, ?)
      ON CONFLICT(sensorId) DO UPDATE SET name = excluded.name
    `;
    db.run(sql, [sensorId, name], function (err) {
      if (err) {
        console.error("❌ DB Error in setSensorName:", err.message);
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

function getSensorName(sensorId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT name FROM sensor_metadata WHERE sensorId = ?`, [sensorId], (err, row) => {
      if (err) reject(err);
      else resolve(row?.name || null);
    });
  });
}

function getAllSensorNames() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT sensorId, name FROM sensor_metadata`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}



function getRecentReadings(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sr.sensorId, sr.timestamp, sr.temperature, sr.humidity, sn.name as sensorName
       FROM sensor_readings sr
       LEFT JOIN sensor_names sn ON sr.sensorId = sn.sensorId
       ORDER BY sr.timestamp DESC
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  insertReading,
  getRecentReadings,
  getSummaryPerDevice,
  getSensorHistory,
  setSensorName,
  getSensorName,
  getAllSensorNames
};
