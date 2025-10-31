import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);
  updateStatus();

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // forward message/draft/clear to all other clients
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    }
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
    updateStatus();
  });
});

// Notify all clients whether a peer is connected or not
function updateStatus() {
  const isConnected = clients.length > 1;
  for (const c of clients) {
    if (c.readyState === 1) {
      c.send(JSON.stringify({ type: "status", connected: isConnected }));
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
