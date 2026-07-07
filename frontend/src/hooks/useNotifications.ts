import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { useSocket } from "./useSocket";
import api from "../config/api";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, string> | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const socket = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initialFetchDone = useRef(false);

  // Fetch initial notifications + unread count
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        api.get("/api/notifications?limit=20"),
        api.get("/api/notifications/unread-count"),
      ]);
      setNotifications(listRes.data.data);
      setNextCursor(listRes.data.nextCursor);
      setUnreadCount(countRes.data.data.count);
    } catch {
      toast.error("Echec du chargement des notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Listen for new notifications via socket
  useEffect(() => {
    if (!socket) return;

    const handler = ({ notification }: { notification: Notification }) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };
    socket.on("notification:new", handler);

    // Refetch apres une reconnexion (pas au premier connect) : des
    // notifications ont pu etre manquees pendant la coupure.
    let hasConnectedOnce = socket.connected;
    const onConnect = () => {
      if (hasConnectedOnce) {
        fetchNotifications();
      }
      hasConnectedOnce = true;
    };
    socket.on("connect", onConnect);

    return () => {
      socket.off("notification:new", handler);
      socket.off("connect", onConnect);
    };
  }, [socket, fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/notifications?limit=20&cursor=${nextCursor}`);
      setNotifications((prev) => [...prev, ...res.data.data]);
      setNextCursor(res.data.nextCursor);
    } catch {
      toast.error("Echec du chargement des notifications");
    } finally {
      setIsLoading(false);
    }
  }, [nextCursor, isLoading]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Echec du marquage comme lu");
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/api/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          readAt: n.readAt || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch {
      toast.error("Echec du marquage global comme lu");
    }
  }, []);

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        const notif = notifications.find((n) => n.id === id);
        await api.delete(`/api/notifications/${id}`);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (notif && !notif.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch {
        toast.error("Echec de la suppression de la notification");
      }
    },
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    hasMore: nextCursor !== null,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}
