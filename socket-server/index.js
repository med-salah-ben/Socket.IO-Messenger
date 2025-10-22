import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"], credentials: true },
});

// In-memory stores
const usersBySocket = new Map(); // socket.id -> { userId, username }
console.log("🚀 ~ usersBySocket:", usersBySocket)
const socketsByUserId = new Map(); // userId -> socket.id
console.log("🚀 ~ socketsByUserId:", socketsByUserId)
const messages = []; // { id, fromUserId, toUserId|null, room, text, ts }
console.log("🚀 ~ messages:", messages)

function now() {
  return new Date().toISOString();
}

io.on("connection", (socket) => {
  console.log(`[io] connected ${socket.id}`);
  socket.on("error", (err) => {
    console.error(`[io] socket error ${socket.id}:`, err);
  });
  // Register user (minimal demo auth)
  socket.on("register", ({ userId, username }) => {
    if (!userId || !username) return;
    usersBySocket.set(socket.id, { userId, username });
    socketsByUserId.set(userId, socket.id);

    socket.join("global");

    // Send recent messages
    const recent = messages.slice(-80);
    console.log("🚀 ~ recent:", recent)
    socket.emit("history", recent);

    io.emit("presence", { type: "join", userId, username, at: now() });
    console.log(`[io] ${username} (${userId}) registered on ${socket.id}`);
  });

  // Typing indicator
  socket.on("typing", ({ toUserId, room }) => {
    const u = usersBySocket.get(socket.id);
    if (!u) return;
    if (toUserId) {
      const targetSocketId = socketsByUserId.get(toUserId);
      if (targetSocketId)
        io.to(targetSocketId).emit("typing", { fromUserId: u.userId });
    } else {
      io.to(room || "global").emit("typing", { fromUserId: u.userId });
    }
  });

  // Send message (public or DM)
  socket.on("send_message", (payload = {}) => {
    try {
      const { text, toUserId, room } = payload;
      const u = usersBySocket.get(socket.id);
      if (!u || !text) return;

      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fromUserId: u.userId,
        toUserId: toUserId || null,
        room: toUserId ? null : room || "global",
        text,
        ts: now(),
      };
      messages.push(msg);

      if (toUserId) {
        const targetSocketId = socketsByUserId.get(toUserId);
        if (targetSocketId) io.to(targetSocketId).emit("message", msg);
        socket.emit("message", msg);
        socket.emit("message:ack", { id: msg.id });
      } else {
        io.to(msg.room).emit("message", msg);
      }
    } catch (e) {
      console.error("[io] send_message handler crashed:", e);
    }
  });

  socket.on('disconnect', (reason) => {
    const u = usersBySocket.get(socket.id);
    if (u) {
      io.emit("presence", {
        type: "leave",
        userId: u.userId,
        username: u.username,
        at: now(),
      });
      socketsByUserId.delete(u.userId);
      usersBySocket.delete(socket.id);
    }
    console.log(`[io] disconnected ${socket.id} — reason: ${reason}`);
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Socket server listening on :${PORT}`));
