// server.js
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.use(express.static("public")); // serve your index.html and assets

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Use a Set instead of array for cleaner client management
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "ping":
          // forward ping to all other clients
          for (const client of clients) {
            if (client !== ws && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: "forwardedPing",
                  timestamp: data.timestamp,
                })
              );
            }
          }
          break;

        case "echo":
          // echo back to sender via partner
          for (const client of clients) {
            if (client !== ws && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: "echoBack",
                  timestamp: data.timestamp,
                })
              );
            }
          }
          break;

        default:
          console.warn("Unknown message type:", data.type);
      }
    } catch (err) {
      console.error("Invalid message received:", err.message);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
