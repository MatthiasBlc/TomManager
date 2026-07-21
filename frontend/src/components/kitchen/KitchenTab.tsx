import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminRights } from "../../hooks/useAdminRights";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonCardGrid } from "../common/Skeleton";
import EmptyState from "../common/EmptyState";
import KitchenManagementPanel from "./KitchenManagementPanel";
import MealFichesList, { type MealFiche } from "./MealFichesList";
import MealFormModal from "./MealFormModal";

interface KitchenView {
  eventKitchenId: string | null;
  chefRoleId: string | null;
  equipierPlanningEnabled: boolean;
  currentUserKitchenRole: "manager" | "chef" | "equipier" | "none";
  meals: MealFiche[];
  allergiesNotes?: string | null;
  chefs?: { id: string; username: string; displayName?: string | null; source: "ROLE" | "MANUAL" }[];
  coursesMembers?: { id: string; username: string; displayName?: string | null }[];
  unassigned?: { id: string; username: string; displayName?: string | null }[];
}

interface Props {
  eventId: string;
  eventStartDate?: string;
  eventEndDate?: string;
}

export default function KitchenTab({ eventId, eventStartDate, eventEndDate }: Props) {
  const { user } = useAuth();
  const { isAdmin, isKitchenManager } = useAdminRights();
  const [data, setData] = useState<KitchenView | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateMeal, setShowCreateMeal] = useState(false);

  const fetchKitchen = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen`);
      setData(res.data.data);
    } catch {
      toast.error("Échec du chargement du module cuisine");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchKitchen();
  }, [fetchKitchen]);

  useEventSocket(eventId, {
    onKitchenConfigUpdated: fetchKitchen,
    onKitchenMealChanged: fetchKitchen,
    onKitchenAssistantChanged: fetchKitchen,
    onKitchenPlanningGenerated: fetchKitchen,
    onReconnected: fetchKitchen,
  });

  if (loading) return <SkeletonCardGrid count={2} />;
  if (!data) return null;

  const isChef = data.currentUserKitchenRole === "chef";
  const canSeeTab = isAdmin || isKitchenManager || isChef;

  if (!canSeeTab) {
    return (
      <EmptyState
        icon={<span>🍳</span>}
        title="Section réservée aux chefs et responsables cuisine"
        description="Retrouve le planning des repas dans l'onglet Infos si le responsable l'a activé."
      />
    );
  }

  const myMeal = data.meals.find((m) => m.chef?.id === user?.id) ?? null;

  return (
    <div className="space-y-6">
      {(isAdmin || isKitchenManager) && (
        <KitchenManagementPanel
          eventId={eventId}
          chefRoleId={data.chefRoleId}
          allergiesNotes={data.allergiesNotes ?? null}
          equipierPlanningEnabled={data.equipierPlanningEnabled}
          chefs={data.chefs ?? []}
          coursesMembers={data.coursesMembers ?? []}
          unassigned={data.unassigned ?? []}
          meals={data.meals}
          onChanged={fetchKitchen}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Fiches repas</h3>
          {isChef && !myMeal && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateMeal(true)}>
              Créer mon repas
            </button>
          )}
        </div>
        {data.allergiesNotes && (
          <div className="alert alert-warning mb-3 text-sm py-2">
            <span>Allergies : {data.allergiesNotes}</span>
          </div>
        )}
        <MealFichesList
          eventId={eventId}
          meals={data.meals}
          currentUserId={user?.id}
          isKitchenManager={isAdmin || isKitchenManager}
          onChanged={fetchKitchen}
          eventStartDate={eventStartDate}
          eventEndDate={eventEndDate}
        />
      </div>

      <MealFormModal
        open={showCreateMeal}
        onClose={() => setShowCreateMeal(false)}
        onSaved={fetchKitchen}
        eventId={eventId}
        eventStartDate={eventStartDate}
        eventEndDate={eventEndDate}
      />
    </div>
  );
}
