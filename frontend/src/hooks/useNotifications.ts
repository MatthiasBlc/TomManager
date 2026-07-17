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

  // Miroir de l'etat courant : les mutations partagees (action locale + echo
  // socket du meme utilisateur sur un autre appareil) doivent etre idempotentes,
  // et la liste paginee ne permet pas de recalculer le compteur.
  const notificationsRef = useRef<Notification[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const applyRead = useCallback((id: string) => {
    const item = notificationsRef.current.find((n) => n.id === id);
    // Item deja lu localement : echo de sa propre action, ne pas re-decrementer
    if (item && item.read) return;
    if (item) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
    }
    // Item absent (au-dela de la page chargee) : le decrement reste correct,
    // l'evenement n'est emis qu'une fois par action
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const applyReadAll = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);
  }, []);

  const applyDeleted = useCallback((id: string) => {
    const item = notificationsRef.current.find((n) => n.id === id);
    // Item absent : deja supprime localement (echo) ou hors page chargee — dans
    // ce dernier cas on ne sait pas s'il etait lu, on ne touche pas au compteur
    if (!item) return;
    if (!item.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

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
      // Dedoublonnage : une course entre un refetch (reconnexion) et l'evenement
      // socket peut livrer deux fois la meme notification
      if (notificationsRef.current.some((n) => n.id === notification.id)) return;
      setNotifications((prev) =>
        prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]
      );
      setUnreadCount((prev) => prev + 1);
    };
    socket.on("notification:new", handler);

    // Sync multi-appareils/onglets : le backend emet vers la room user:<id>
    // apres chaque mark-read / read-all / delete
    const onRead = ({ id }: { id: string }) => applyRead(id);
    const onReadAll = () => applyReadAll();
    const onDeleted = ({ id }: { id: string }) => applyDeleted(id);
    socket.on("notification:read", onRead);
    socket.on("notification:read-all", onReadAll);
    socket.on("notification:deleted", onDeleted);

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
      socket.off("notification:read", onRead);
      socket.off("notification:read-all", onReadAll);
      socket.off("notification:deleted", onDeleted);
      socket.off("connect", onConnect);
    };
  }, [socket, fetchNotifications, applyRead, applyReadAll, applyDeleted]);

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

  // Les actions locales passent par les memes mutations idempotentes que les
  // echos socket : quel que soit l'ordre d'arrivee (reponse API vs echo), une
  // seule mise a jour du compteur est appliquee.
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await api.patch(`/api/notifications/${id}/read`);
        applyRead(id);
      } catch {
        toast.error("Echec du marquage comme lu");
      }
    },
    [applyRead]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/api/notifications/read-all");
      applyReadAll();
    } catch {
      toast.error("Echec du marquage global comme lu");
    }
  }, [applyReadAll]);

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/api/notifications/${id}`);
        applyDeleted(id);
      } catch {
        toast.error("Echec de la suppression de la notification");
      }
    },
    [applyDeleted]
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
