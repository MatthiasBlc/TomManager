import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonCardGrid } from "../common/Skeleton";
import EmptyState from "../common/EmptyState";
import TableDetailModal from "./TableDetailModal";
import { formatParisTime, formatParisDate, parisDayKey } from "../../utils/dateTime";
import { type TableSummary } from "./computeLayout";

interface Props {
  eventId: string;
}

export default function MyPlanningSection({ eventId }: Props) {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

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

  // Regroupement par jour (Europe/Paris), meme convention que le planning cuisine
  const tablesByDay = new Map<string, TableSummary[]>();
  for (const t of myTables) {
    const key = parisDayKey(t.startDateTime);
    const bucket = tablesByDay.get(key);
    if (bucket) bucket.push(t);
    else tablesByDay.set(key, [t]);
  }

  if (loading) return <SkeletonCardGrid count={1} />;

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 md:p-6">
        <h3 className="card-title text-base md:text-lg">🎲 Mon planning</h3>
        {myTables.length === 0 ? (
          <EmptyState icon={<span>🎲</span>} title="Tu n'es inscrit sur aucune partie" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...tablesByDay.entries()].map(([dayKey, dayTables]) => (
              <div key={dayKey} className="card bg-base-200 shadow-none">
                <div className="card-body p-3 space-y-2">
                  <h4 className="text-xs font-semibold uppercase opacity-60 capitalize">
                    📅{" "}
                    {formatParisDate(dayTables[0].startDateTime, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h4>
                  <ul className="space-y-2">
                    {dayTables.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTableId(t.id)}
                          className="w-full text-left flex items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-100 p-3 hover:border-primary hover:bg-base-100/70 transition-colors"
                        >
                          <div className="min-w-0">
                            <span
                              className={`badge badge-sm mb-1 ${t.type === "JDR" ? "badge-primary" : "badge-accent"}`}
                            >
                              {t.type}
                            </span>
                            <p className="font-semibold text-sm truncate">{t.title}</p>
                            <p className="text-xs opacity-70">
                              {formatParisTime(t.startDateTime)} - {formatParisTime(t.endDateTime)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-none">
                            {t.isGM && t.type === "JDR" && (
                              <span className="badge badge-secondary badge-sm">MJ</span>
                            )}
                            {t.currentUserStatus && (
                              <span
                                className={`badge badge-sm ${
                                  t.currentUserStatus === "CONFIRMED"
                                    ? "badge-success"
                                    : "badge-warning"
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TableDetailModal
        open={selectedTableId !== null}
        onClose={() => setSelectedTableId(null)}
        tableId={selectedTableId}
        eventId={eventId}
        onTableDeleted={fetchTables}
        onTableUpdated={fetchTables}
      />
    </div>
  );
}
