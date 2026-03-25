import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

let globalSocket: Socket | null = null;

export function useSocket(): Socket | null {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
      socketRef.current = null;
      return;
    }

    if (!globalSocket) {
      globalSocket = io(BACKEND_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
    }

    socketRef.current = globalSocket;

    return () => {
      // Don't disconnect on unmount — keep global singleton alive
    };
  }, [user]);

  return socketRef.current;
}
