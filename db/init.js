const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'sensors.db');

// Ensure the db folder exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open and initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to open database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      temperature REAL,
      humidity REAL,
      rawHex TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Failed to create sensor_readings table:', err.message);
    } else {
      console.log('✅ sensor_readings table ready');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_metadata (
      sensorId TEXT PRIMARY KEY,
      name TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Failed to create sensor_metadata table:', err.message);
    } else {
      console.log('✅ sensor_metadata table ready');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_aggregated_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorId TEXT NOT NULL,
      timeFrame TEXT NOT NULL,           -- e.g., "5m", "15m", "1h", etc.
      lastTimestamp TEXT NOT NULL,       -- When the last reading was taken
      lastTemperature REAL,
      lastHumidity REAL,
      meanTemperature REAL,
      meanHumidity REAL,
      aggregationTime TEXT NOT NULL      -- When this aggregation was performed
    )
  `, (err) => {
    if (err) {
      console.error('❌ Failed to create sensor_aggregated_data table:', err.message);
    } else {
      console.log('✅ sensor_aggregated_data table ready');
    }
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS aggregator_state (
      sensorId TEXT PRIMARY KEY,
      lastAggregatedAt TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Failed to create sensor_aggregated_data table:', err.message);
    } else {
      console.log('✅ sensor_aggregated_data table ready');
    }
  });
});




db.close((err) => {
  if (err) {
    console.error('❌ Failed to close database:', err.message);
  } else {
    console.log('✅ Database closed');
  }
});
