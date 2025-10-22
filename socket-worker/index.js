import "dotenv/config";
import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";
const BOT_USER_ID = process.env.BOT_USER_ID || "bot-1";
const BOT_USERNAME = process.env.BOT_USERNAME || "HelperBot";

// Avoid duplicate clients if the file somehow gets executed twice
if (global.__botRunning) {
  console.log("[bot] instance already running; exiting duplicate");
  process.exit(0);
}
global.__botRunning = true;

console.log("[bot] starting worker pid=", process.pid, "url=", SERVER_URL);

const socket = io(SERVER_URL, {
  // Let Socket.IO manage transports and reconnection
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500, // start at 0.5s
  reconnectionDelayMax: 5000, // cap backoff at 5s
  timeout: 20000, // connect timeout
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("[bot] connected as", socket.id);
  socket.emit("register", { userId: BOT_USER_ID, username: BOT_USERNAME });
});

socket.on("disconnect", (reason) => {
  console.log("[bot] disconnected reason=", reason);
});

socket.on("connect_error", (err) => {
  console.error("[bot] connect_error:", err?.message || err);
});
// checccck this if i can remove it
socket.io.on("reconnect_attempt", (n) =>
  console.log("[bot] reconnect_attempt", n)
);
socket.io.on("reconnect_error", (err) =>
  console.log("[bot] reconnect_error", err?.message || err)
);
socket.io.on("reconnect_failed", () => console.log("[bot] reconnect_failed"));

socket.on("history", (hist) => {
  console.log(
    "[bot] received history size=",
    Array.isArray(hist.length) ? hist : 0
  );
});

socket.on("message", (msg) => {
  if (msg.text && /@bot/i.test(msg.text) && msg.fromUserId !== BOT_USER_ID) {
    const reply = `Hi! You mentioned me. Time: ${new Date().toLocaleTimeString()}`;
    const target = msg.toUserId
      ? { toUserId: msg.fromUserId }
      : { room: msg.room };
    socket.emit("send_message", { text: reply, ...target });
  }
  if (msg.text) {
    console.log("🚀 ~ message:", msg);
  }
});

process.on("SIGINT", () => {
  console.log("[bot] SIGINT — closing socket gracefully");
  socket.close();
  process.exit(0);
});
