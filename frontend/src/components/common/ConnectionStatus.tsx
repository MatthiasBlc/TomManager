import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useSocket } from "../../hooks/useSocket";

export default function ConnectionStatus() {
  const socket = useSocket();
  const [connected, setConnected] = useState(false);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return;
    }

    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      if (wasDisconnected.current) {
        toast.success("Connexion rétablie");
        wasDisconnected.current = false;
      }
    };
    const onDisconnect = () => {
      setConnected(false);
      wasDisconnected.current = true;
      toast.error("Connexion perdue — reconnexion en cours...");
    };

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
      title={connected ? "Connecté" : "Déconnecté"}
    />
  );
}
