import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "ping") {
        // Forward ping to partner
        clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify({ type: "forwardedPing", timestamp: data.timestamp }));
          }
        });
      } else if (data.type === "echo") {
        // Return echo to sender
        clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify({ type: "echoBack", timestamp: data.timestamp }));
          }
        });
      }
    } catch (err) {
      console.error("Message parse error:", err);
    }
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
