import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = []; // store { ws, id }

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

// Update status for all clients
function updateStatuses() {
  const count = clients.length;

  clients.forEach((client, i) => {
    if (i < 2) {
      // First two clients
      const color = count === 1 ? "red" : "green";
      send(client.ws, { type: "status", color });
    } else {
      // Third or more
      send(client.ws, { type: "status", color: "yellow" });
    }
  });
}

wss.on("connection", (ws) => {
  const client = { ws, id: Date.now() };
  clients.push(client);
  updateStatuses();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // Allow only first two clients to exchange text
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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
