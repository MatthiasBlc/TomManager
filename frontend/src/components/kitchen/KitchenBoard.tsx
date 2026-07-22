import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useEventSocket } from "../../hooks/useEventSocket";
import EmptyState from "../common/EmptyState";
import { SkeletonCardGrid } from "../common/Skeleton";
import { getErrorMessage } from "../../config/apiErrors";
import { serviceLabel } from "./units";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface BoardMeal {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  maxAssistants: number;
  remainingSeats: number;
  chef: Person | null;
  assistants: Person[];
}

interface KitchenView {
  currentUserKitchenRole: "manager" | "chef" | "equipier" | "none";
  equipierPlanningEnabled: boolean;
  meals: BoardMeal[];
}

const displayedName = (u: Person) => u.displayName ?? u.username;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function KitchenBoard({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<KitchenView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const fetchKitchen = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen`);
      setData(res.data.data);
    } catch {
      // Silencieux : le board ne bloque pas l'affichage de l'onglet Infos
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchKitchen();
  }, [fetchKitchen]);

  useEventSocket(eventId, {
    onKitchenMealChanged: fetchKitchen,
    onKitchenAssistantChanged: fetchKitchen,
    onKitchenPlanningGenerated: fetchKitchen,
    onKitchenConfigUpdated: fetchKitchen,
    onReconnected: fetchKitchen,
  });

  if (loading) return <SkeletonCardGrid count={2} />;
  if (!data) return null;

  const canSeeBoard =
    data.currentUserKitchenRole === "manager" ||
    data.currentUserKitchenRole === "chef" ||
    (data.currentUserKitchenRole === "equipier" && data.equipierPlanningEnabled);

  if (!canSeeBoard) return null;

  const currentMeal = data.meals.find((m) => m.assistants.some((a) => a.id === user?.id));

  const handleJoin = async (mealId: string) => {
    setPendingAction(mealId);
    try {
      await api.post(`/api/events/${eventId}/kitchen/meals/${mealId}/assistants`);
      toast.success("Inscrit au repas !");
      fetchKitchen();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'inscription"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleLeave = async (mealId: string) => {
    setPendingAction(mealId);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/meals/${mealId}/assistants/me`);
      toast.success("Désinscrit du repas");
      fetchKitchen();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la désinscription"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 md:p-6">
        <h3 className="card-title text-base md:text-lg">Planning cuisine</h3>
        {data.meals.length === 0 ? (
          <EmptyState icon={<span>🍽️</span>} title="Aucun repas planifié pour l'instant" />
        ) : (
          <div className="space-y-3 mt-2">
            {data.meals.map((meal) => {
              const isCurrent = currentMeal?.id === meal.id;
              const isFull = meal.remainingSeats <= 0;
              return (
                <div key={meal.id} className="card bg-base-200 shadow-none">
                  <div className="card-body p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          {meal.name}
                          <span className="badge badge-outline badge-sm">
                            {serviceLabel(meal.service)}
                          </span>
                          {!meal.chef && (
                            <span className="badge badge-warning badge-sm">sans chef</span>
                          )}
                        </h4>
                        <p className="text-xs opacity-70 mt-0.5">
                          {meal.chef ? displayedName(meal.chef) : "Sans chef"} ·{" "}
                          {formatDateTime(meal.startDateTime)} → {formatDateTime(meal.endDateTime)}
                        </p>
                      </div>
                      <span className="badge badge-ghost badge-sm shrink-0">
                        {meal.assistants.length}/{meal.maxAssistants} places
                      </span>
                    </div>

                    {meal.assistants.length > 0 && (
                      <p className="text-xs opacity-70 mt-2">
                        Inscrits : {meal.assistants.map(displayedName).join(", ")}
                      </p>
                    )}

                    <div className="mt-2">
                      {isCurrent ? (
                        <button
                          className="btn btn-outline btn-warning btn-xs"
                          disabled={!!pendingAction}
                          onClick={() => handleLeave(meal.id)}
                        >
                          {pendingAction === meal.id && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          Se désinscrire
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-xs"
                          disabled={!!pendingAction || isFull}
                          onClick={() => handleJoin(meal.id)}
                        >
                          {pendingAction === meal.id && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          {isFull ? "Complet" : currentMeal ? "Se déplacer ici" : "S'inscrire"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
