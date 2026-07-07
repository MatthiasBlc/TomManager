import { useEffect } from "react";
import { useSocket } from "./useSocket";

interface EventSocketCallbacks {
  onTableCreated?: () => void;
  onTableUpdated?: () => void;
  onTableDeleted?: () => void;
  onPlayerJoined?: () => void;
  onPlayerLeft?: () => void;
  onPlayerKicked?: () => void;
  onPlayerPromoted?: () => void;
  onPlayerDemoted?: () => void;
  onParticipantRemoved?: () => void;
  onBoardGameAdded?: () => void;
  onBoardGameRemoved?: () => void;
  // Appele apres une reconnexion (pas au premier connect) : le join:event
  // precedent est perdu cote serveur, et des evenements ont pu etre manques
  // pendant la coupure — l'appelant doit refetcher les donnees actives.
  onReconnected?: () => void;
}

export function useEventSocket(eventId: string | undefined, callbacks: EventSocketCallbacks) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !eventId) return;

    let hasConnectedOnce = socket.connected;
    socket.emit("join:event", { eventId });

    const onConnect = () => {
      // Le join:event precedent est perdu cote serveur apres une reconnexion :
      // on rejoint la room a chaque connect, pas seulement au premier.
      socket.emit("join:event", { eventId });
      if (hasConnectedOnce) {
        callbacks.onReconnected?.();
      }
      hasConnectedOnce = true;
    };
    socket.on("connect", onConnect);

    const events: [string, (() => void) | undefined][] = [
      ["table:created", callbacks.onTableCreated],
      ["table:updated", callbacks.onTableUpdated],
      ["table:deleted", callbacks.onTableDeleted],
      ["table:player:joined", callbacks.onPlayerJoined],
      ["table:player:left", callbacks.onPlayerLeft],
      ["table:player:kicked", callbacks.onPlayerKicked],
      ["table:player:promoted", callbacks.onPlayerPromoted],
      ["table:player:demoted", callbacks.onPlayerDemoted],
      ["participant:removed", callbacks.onParticipantRemoved],
      ["boardgame:added", callbacks.onBoardGameAdded],
      ["boardgame:removed", callbacks.onBoardGameRemoved],
    ];

    const handlers: [string, () => void][] = [];
    for (const [event, cb] of events) {
      if (cb) {
        socket.on(event, cb);
        handlers.push([event, cb]);
      }
    }

    return () => {
      socket.off("connect", onConnect);
      socket.emit("leave:event", { eventId });
      for (const [event, cb] of handlers) {
        socket.off(event, cb);
      }
    };
  }, [socket, eventId]); // eslint-disable-line react-hooks/exhaustive-deps
}
