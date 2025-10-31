import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function updateStatuses() {
  const count = clients.length;
  clients.forEach((client, i) => {
    if (i < 2) {
      const color = count === 1 ? "red" : "green";
      send(client.ws, { type: "status", color });
    } else {
      send(client.ws, { type: "status", color: "yellow" });
    }
  });
}

// Add periodic heartbeat ping
function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  const client = { ws, id: Date.now() };
  clients.push(client);
  updateStatuses();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (clients.indexOf(client) < 2 && data.type === "textSync") {
        clients.forEach((c, idx) => {
          if (idx < 2 && c !== client && c.ws.readyState === 1) {
            c.ws.send(JSON.stringify(data));
          }
        });
      }
    } catch (err) {
      console.error("Message parse error:", err);
    }
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== client);
    updateStatuses();
  });
});

// 🕒 Every 5 seconds, ping all clients
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate(); // force close dead sockets
      clients = clients.filter((c) => c.ws !== ws);
      updateStatuses();
      return;
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 1000);

wss.on("close", () => {
  clearInterval(interval);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

