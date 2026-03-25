import { useState, useEffect } from "react";
import { useSocket } from "../../hooks/useSocket";

export default function ConnectionStatus() {
  const socket = useSocket();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return;
    }

    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  if (!socket) return null;

  return (
    <span
      className={`badge badge-xs ${connected ? "badge-success" : "badge-error"}`}
      title={connected ? "Connected" : "Disconnected"}
    />
  );
}
