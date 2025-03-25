require('dotenv').config(); // Load environment variables

const config = {
  raspberryIp: process.env.RASPBERRY_IP || '192.168.15.19',
  localhost: process.env.LOCALHOST || '127.0.0.1',
  apiPort: parseInt(process.env.API_PORT || 3000, 10),
  sensorServicePort: parseInt(process.env.SENSOR_SERVICE_PORT || 3001, 10),
  websocketPort: parseInt(process.env.WEBSOCKET_PORT || 1880, 10),
  websocketPath: process.env.WEBSOCKET_PATH || '/ws/data',
  debug: process.env.DEBUG === 'true',
};

function getFullUrl(service, useLocalhost = false) {
  const ip = useLocalhost ? config.localhost : config.raspberryIp;

  const urls = {
    api: `http://${ip}:${config.apiPort}`,
    sensorService: `http://${ip}:${config.sensorServicePort}`,
    websocket: `ws://${ip}:${config.websocketPort}${config.websocketPath}`,
  };

  return urls[service] || urls.api;
}

module.exports = { config, getFullUrl };
