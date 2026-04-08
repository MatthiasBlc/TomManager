import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import BoardGameList from "./BoardGameList";
import AddBoardGameModal from "./AddBoardGameModal";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonBoardGameList } from "../common/Skeleton";

interface EventBoardGameEntry {
  id: string;
  boardGame: {
    id: string;
    name: string;
    yearPublished?: number | null;
    minPlayers?: number | null;
    maxPlayers?: number | null;
    playingTime?: number | null;
    imageUrl?: string | null;
  };
  broughtBy: { id: string; username: string };
}

interface Props {
  eventId: string;
}

export default function BoardGameTab({ eventId }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<EventBoardGameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/boardgames`);
      setEntries(res.data.data);
    } catch {
      toast.error("Failed to load board games");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEventSocket(eventId, {
    onBoardGameAdded: fetchEntries,
    onBoardGameRemoved: fetchEntries,
  });

  const handleRemove = async (entryId: string) => {
    try {
      await api.delete(`/api/events/${eventId}/boardgames/${entryId}`);
      toast.success("Board game removed");
      fetchEntries();
    } catch {
      toast.error("Failed to remove board game");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Board Games {!loading && `(${entries.length})`}</h2>
        <button
          className="btn btn-primary btn-sm active:scale-95 transition-transform"
          onClick={() => setShowAdd(true)}
        >
          Add Game
        </button>
      </div>

      {loading ? (
        <SkeletonBoardGameList count={3} />
      ) : (
        <BoardGameList
          entries={entries}
          onRemove={handleRemove}
          currentUserId={user?.id}
          isAdmin={user?.role === "ADMIN"}
        />
      )}

      <AddBoardGameModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={fetchEntries}
        eventId={eventId}
      />
    </div>
  );
}
