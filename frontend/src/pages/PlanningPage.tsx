import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import TimelineView from "../components/planning/TimelineView";
import CreateTableModal from "../components/planning/CreateTableModal";
import { useEventSocket } from "../hooks/useEventSocket";

interface TableSummary {
  id: string;
  title: string;
  pitch: string | null;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
  creator: { id: string; username: string };
  tags: { id: string; name: string }[];
  confirmedCount: number;
  waitlistCount: number;
  currentUserStatus: string | null;
  isGM: boolean;
}

export default function PlanningPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/tables`);
      setTables(res.data.data);
    } catch {
      toast.error("Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEventSocket(eventId, {
    onTableCreated: fetchTables,
    onTableUpdated: fetchTables,
    onTableDeleted: fetchTables,
    onPlayerJoined: fetchTables,
    onPlayerLeft: fetchTables,
    onPlayerKicked: fetchTables,
    onPlayerPromoted: fetchTables,
    onPlayerDemoted: fetchTables,
  });

  const handleTableClick = (tableId: string) => {
    navigate(`/events/${eventId}/planning/${tableId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            className="btn btn-ghost btn-sm mb-2"
            onClick={() => navigate(`/events/${eventId}`)}
          >
            &larr; Back to event
          </button>
          <h1 className="text-2xl font-bold">Planning</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Create Table
        </button>
      </div>

      <TimelineView tables={tables} onTableClick={handleTableClick} />

      <CreateTableModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchTables}
        eventId={eventId!}
      />
    </div>
  );
}
