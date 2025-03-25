let clients = [];

function startDashboardSocketServer(server) {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    clients.push(ws);
    console.log("🖥️ Dashboard connected");

    ws.on('close', () => {
      clients = clients.filter(c => c !== ws);
      console.log("❌ Dashboard disconnected");
    });
  });
}

function broadcast(data) {
  const payload = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

module.exports = {
  startDashboardSocketServer,
  broadcast,
};
