import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import type { KitchenViewData } from "../../hooks/useKitchenData";
import type { MealFiche } from "./MealFichesList";
import EmptyState from "../common/EmptyState";
import { SkeletonCardGrid } from "../common/Skeleton";
import { getErrorMessage } from "../../config/apiErrors";
import { serviceLabel, dayLabel } from "./units";
import { parisDayKey } from "../../utils/dateTime";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

type Service = "LUNCH" | "DINNER";
const SERVICES: Service[] = ["LUNCH", "DINNER"];

interface Props {
  eventId: string;
  data: KitchenViewData | null;
  loading: boolean;
  onChanged: () => void;
}

export default function KitchenBoard({ eventId, data, loading, onChanged: fetchKitchen }: Props) {
  const { user } = useAuth();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  if (loading) return <SkeletonCardGrid count={2} />;
  if (!data) return null;

  const canSeeBoard =
    data.currentUserKitchenRole === "manager" ||
    data.currentUserKitchenRole === "chef" ||
    (data.currentUserKitchenRole === "equipier" && data.equipierPlanningEnabled);

  if (!canSeeBoard) return null;

  const currentMeal = data.meals.find((m) => m.assistants.some((a) => a.id === user?.id));
  // Point 4 : le bouton s'inscrire/se deplacer/se desinscrire n'est jamais propose
  // a un chef ni a un membre de l'equipe courses (role-exclusivite backend).
  const canJoin = data.currentUserKitchenRole === "equipier" && !data.isCoursesMember;

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

  // Matrice construite depuis les repas reellement presents (pas un recalcul
  // theorique de la grille attendue) : gere naturellement les creneaux manuels
  // hors-grille et l'absence de generation.
  const dayKeys = Array.from(new Set(data.meals.map((m) => parisDayKey(m.startDateTime)))).sort();
  const dayIso = new Map(dayKeys.map((k) => [k, data.meals.find((m) => parisDayKey(m.startDateTime) === k)!.startDateTime]));
  const cellByKey = new Map(data.meals.map((m) => [`${parisDayKey(m.startDateTime)}|${m.service}`, m]));

  const renderCell = (meal: MealFiche | undefined) => {
    if (!meal) {
      return <div className="text-xs opacity-30 italic px-1">—</div>;
    }
    const isCurrent = currentMeal?.id === meal.id;
    const isFull = meal.remainingSeats <= 0;
    return (
      <div className="space-y-1 min-w-[9rem]">
        <p className="font-semibold text-sm">{meal.name}</p>
        <p className="text-xs opacity-70">{meal.chef ? displayedName(meal.chef) : "Sans chef"}</p>
        <p className="text-xs opacity-70">
          Équipiers :{" "}
          {meal.assistants.length > 0
            ? meal.assistants.map(displayedName).join(", ")
            : "aucun équipier"}{" "}
          ({meal.assistants.length}/{meal.maxAssistants})
        </p>
        {canJoin && (
          <div className="pt-1">
            {isCurrent ? (
              <button
                className="btn btn-outline btn-warning btn-xs"
                disabled={!!pendingAction}
                onClick={() => handleLeave(meal.id)}
              >
                {pendingAction === meal.id && <span className="loading loading-spinner loading-xs" />}
                Se désinscrire
              </button>
            ) : (
              <button
                className="btn btn-primary btn-xs"
                disabled={!!pendingAction || isFull}
                onClick={() => handleJoin(meal.id)}
              >
                {pendingAction === meal.id && <span className="loading loading-spinner loading-xs" />}
                {isFull ? "Complet" : currentMeal ? "Se déplacer ici" : "S'inscrire"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 md:p-6">
        <h3 className="card-title text-base md:text-lg">Planning cuisine</h3>

        {canJoin && !currentMeal && (
          <div className="alert alert-info py-2 text-sm">
            <span>🍳 Tu n'as pas encore choisi ton créneau de cuisine !</span>
          </div>
        )}

        {data.meals.length === 0 ? (
          <EmptyState icon={<span>🍽️</span>} title="Aucun repas planifié pour l'instant" />
        ) : (
          <>
            {/* Desktop : matrice jour (colonnes) x service (lignes) */}
            <div className="hidden md:block overflow-x-auto mt-2">
              <table className="table table-sm border border-base-300">
                <thead>
                  <tr>
                    <th className="bg-base-200"></th>
                    {dayKeys.map((k) => (
                      <th key={k} className="bg-base-200 capitalize">
                        {dayLabel(dayIso.get(k)!)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SERVICES.map((service) => (
                    <tr key={service}>
                      <th className="bg-base-200 align-top">{serviceLabel(service)}</th>
                      {dayKeys.map((k) => (
                        <td key={k} className="align-top">
                          {renderCell(cellByKey.get(`${k}|${service}`))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile : une carte par jour, sous-lignes Midi/Soir */}
            <div className="md:hidden space-y-3 mt-2">
              {dayKeys.map((k) => (
                <div key={k} className="card bg-base-200 shadow-none">
                  <div className="card-body p-3 space-y-2">
                    <h4 className="font-semibold text-sm capitalize">{dayLabel(dayIso.get(k)!)}</h4>
                    {SERVICES.map((service) => (
                      <div key={service} className="border-t border-base-300 pt-2 first:border-t-0 first:pt-0">
                        <p className="text-xs font-medium opacity-60 mb-1">{serviceLabel(service)}</p>
                        {renderCell(cellByKey.get(`${k}|${service}`))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
