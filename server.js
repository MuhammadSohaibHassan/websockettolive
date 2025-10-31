// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// rooms: Map<roomId, Set<ws>>
const rooms = new Map();
// history: Map<roomId, Array<{id, from, text, ts}>>
const history = new Map();

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  if (!history.has(roomId)) history.set(roomId, []);
}

wss.on("connection", (ws) => {
  // store room id on the socket object once client joins
  ws.roomId = null;
  ws.userId = null;

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (err) {
      console.error("Invalid JSON:", err);
      return;
    }

    // Handle join
    if (data.type === "join") {
      const { room, userId } = data;
      if (!room || typeof room !== "string") return;
      ws.roomId = room;
      ws.userId = userId || (Math.random().toString(36).slice(2, 9));
      ensureRoom(room);
      const set = rooms.get(room);
      set.add(ws);

      // send current history to the new client
      const hist = history.get(room) || [];
      ws.send(JSON.stringify({ type: "history", history: hist }));

      // notify room about participant count (optional)
      const participantCount = [...set].filter((s) => s.readyState === 1).length;
      for (const client of set) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "participants", count: participantCount }));
        }
      }
      return;
    }

    // Require joined room for other operations
    const roomId = ws.roomId;
    if (!roomId) return;

    switch (data.type) {
      // Character-by-character draft typing sync
      case "typing": {
        // forward draft to other clients in the room
        const set = rooms.get(roomId);
        for (const client of set) {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify({
              type: "peerDraft",
              from: ws.userId,
              draft: data.draft || ""
            }));
          }
        }
        break;
      }

      // Commit message (press Enter)
      case "commit": {
        const text = typeof data.text === "string" ? data.text : "";
        const msg = {
          id: Math.random().toString(36).slice(2, 10),
          from: ws.userId,
          text,
          ts: Date.now()
        };
        // store in history
        const arr = history.get(roomId);
        arr.push(msg);

        // broadcast the committed message to all clients in room
        const set = rooms.get(roomId);
        for (const client of set) {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ type: "message", message: msg }));
          }
        }
        break;
      }

      // Optional: client asks to clear their draft (handled on client side)
      default:
        console.warn("Unknown message type:", data.type);
    }
  });

  ws.on("close", () => {
    const roomId = ws.roomId;
    if (!roomId) return;
    const set = rooms.get(roomId);
    if (!set) return;
    set.delete(ws);
    // notify remaining clients participant count
    for (const client of set) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "participants", count: [...set].length }));
      }
    }
    // if room empty, optionally delete data to free memory
    if (set.size === 0) {
      rooms.delete(roomId);
      history.delete(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
