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
  `);

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
});

db.close((err) => {
  if (err) {
    console.error('❌ Failed to close database:', err.message);
  }
});
