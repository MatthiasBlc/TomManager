import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonCardGrid } from "../common/Skeleton";
import EmptyState from "../common/EmptyState";
import { formatParisTime } from "../../utils/dateTime";
import { type TableSummary } from "./computeLayout";

interface Props {
  eventId: string;
}

export default function MyPlanningSection({ eventId }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/tables`);
      setTables(res.data.data);
    } catch {
      toast.error("Échec du chargement de mon planning");
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
    onReconnected: fetchTables,
  });

  // MJ ou joueur (confirme ou en liste d'attente) : les deux comptent comme "inscrit"
  const myTables = tables
    .filter((t) => t.isGM || t.currentUserStatus)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  const openTable = (tableId: string) => {
    setSearchParams({ tab: "planning", table: tableId }, { replace: true });
  };

  if (loading) return <SkeletonCardGrid count={1} />;

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 md:p-6">
        <h3 className="card-title text-base md:text-lg">🎲 Mon planning</h3>
        {myTables.length === 0 ? (
          <EmptyState icon={<span>🎲</span>} title="Tu n'es inscrit sur aucune partie" />
        ) : (
          <ul className="space-y-2">
            {myTables.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openTable(t.id)}
                  className="w-full text-left flex items-center justify-between gap-2 rounded-lg border border-base-300 p-3 hover:border-primary hover:bg-base-200/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{t.title}</p>
                    <p className="text-xs opacity-70">
                      {formatParisTime(t.startDateTime)} - {formatParisTime(t.endDateTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-none">
                    {t.isGM && <span className="badge badge-secondary badge-sm">MJ</span>}
                    {t.currentUserStatus && (
                      <span
                        className={`badge badge-sm ${
                          t.currentUserStatus === "CONFIRMED" ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {t.currentUserStatus === "CONFIRMED" ? "Joueur" : "Liste d'attente"}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
