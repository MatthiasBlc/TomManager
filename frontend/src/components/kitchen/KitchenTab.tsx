import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminRights } from "../../hooks/useAdminRights";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonCardGrid } from "../common/Skeleton";
import EmptyState from "../common/EmptyState";
import KitchenManagementPanel from "./KitchenManagementPanel";
import KitchenDashboard from "./KitchenDashboard";
import MealFichesList, { type MealFiche } from "./MealFichesList";
import MealFormModal from "./MealFormModal";

interface KitchenView {
  eventKitchenId: string | null;
  chefRoleId: string | null;
  equipierPlanningEnabled: boolean;
  currentUserKitchenRole: "manager" | "chef" | "equipier" | "none";
  isChef: boolean;
  meals: MealFiche[];
  allergiesNotes?: string | null;
  chefs?: {
    id: string;
    username: string;
    displayName?: string | null;
    source: "ROLE" | "MANUAL";
  }[];
  coursesMembers?: { id: string; username: string; displayName?: string | null }[];
  unassigned?: { id: string; username: string; displayName?: string | null }[];
  dashboard?: { chefsCount: number; coursesCount: number; unassignedCount: number };
}

interface Props {
  eventId: string;
  eventStartDate?: string;
  eventEndDate?: string;
}

type Section = "gestion" | "mon-repas";

export default function KitchenTab({ eventId, eventStartDate, eventEndDate }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdminRights();
  const [data, setData] = useState<KitchenView | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateMeal, setShowCreateMeal] = useState(false);
  const [section, setSection] = useState<Section>("gestion");

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

  const isManager = data.currentUserKitchenRole === "manager";
  const isChefUser = data.isChef;
  const isPlainAdmin = isAdmin && !isManager && !isChefUser;
  const canSeeTab = isAdmin || isManager || isChefUser;

  if (!canSeeTab) {
    return (
      <EmptyState
        icon={<span>🍳</span>}
        title="Section réservée aux chefs et responsables cuisine"
        description="Retrouve le planning des repas dans l'onglet Infos si le responsable l'a activé."
      />
    );
  }

  if (isPlainAdmin) {
    return (
      <KitchenDashboard
        chefsCount={data.dashboard?.chefsCount ?? 0}
        coursesCount={data.dashboard?.coursesCount ?? 0}
        unassignedCount={data.dashboard?.unassignedCount ?? 0}
        equipierPlanningEnabled={data.equipierPlanningEnabled}
        meals={data.meals}
      />
    );
  }

  const myMeal = data.meals.find((m) => m.chef?.id === user?.id) ?? null;
  const showManagement = isManager && (!isChefUser || section === "gestion");
  const showCreateCta = isChefUser && !myMeal && (!isManager || section === "mon-repas");

  return (
    <div className="space-y-6">
      {isManager && isChefUser && (
        <div className="tabs tabs-boxed inline-flex">
          <button
            className={`tab ${section === "gestion" ? "tab-active" : ""}`}
            onClick={() => setSection("gestion")}
          >
            Gestion
          </button>
          <button
            className={`tab ${section === "mon-repas" ? "tab-active" : ""}`}
            onClick={() => setSection("mon-repas")}
          >
            Mon repas
          </button>
        </div>
      )}

      {showManagement && (
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
          {showCreateCta && (
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
          isKitchenManager={isManager}
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
