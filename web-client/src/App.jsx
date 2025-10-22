import React, { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

export default function App() {
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [userId] = useState(() => "user-" + Math.random().toString(36).slice(2, 6));
  const [username] = useState(() => "User" + Math.floor(Math.random() * 1000));
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [typingFrom, setTypingFrom] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("register", { userId, username });
    };
    const onDisconnect = (reason) => {
      setSocketConnected(false);
      console.log("[client] disconnect reason:", reason);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", (e) => console.error("[client] connect_error:", e));
    socket.on("history", (hist) => setMessages(hist));
    socket.on("message", (msg) => setMessages((m) => [...m, msg]));
    socket.on("message:ack", ({ id }) => console.log("Delivered:", id));
    socket.on("typing", ({ fromUserId }) => {
      setTypingFrom(fromUserId);
      setTimeout(() => setTypingFrom(null), 1200);
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error");
      socket.off("history");
      socket.off("message");
      socket.off("message:ack");
      socket.off("typing");
    };
  }, [userId, username]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const payload = toUserId ? { text, toUserId } : { text, room: "global" };
    console.log("[client] emit send_message", payload);
    socket.emit("send_message", payload);
    setInput("");
  };

  const typing = () => {
    socket.emit("typing", toUserId ? { toUserId } : { room: "global" });
  };

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", fontFamily: "system-ui, Arial" }}>
      <h2>Socket.IO Messenger</h2>
      <div style={{ marginBottom: 12 }}>
        Status:  {socketConnected ?  `${userId} 🟢 Connected `: "🔴 Disconnected"}
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
        <input value={toUserId} onChange={(e) => setToUserId(e.target.value)} placeholder="DM to userId (optional)" />
        <button onClick={() => setToUserId("")}>Clear DM</button>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 8, padding: 12, minHeight: 300 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ margin: "6px 0", padding: 6, background: "#fafafa", borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: "#666" }}>
              <b>{m.fromUserId}</b> → {m.toUserId ? `DM:${m.toUserId}` : m.room}
              <span style={{ marginLeft: 8 }}>{new Date(m.ts).toLocaleTimeString()}</span>
            </div>
            <div>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {typingFrom && <div style={{ marginTop: 6, color: "#888" }}>{typingFrom} is typing…</div>}

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? send() : typing())}
          placeholder="Type a message"
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
