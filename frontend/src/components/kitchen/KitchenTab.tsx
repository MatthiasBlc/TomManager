import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminRights } from "../../hooks/useAdminRights";
import type { KitchenViewData } from "../../hooks/useKitchenData";
import { SkeletonCardGrid } from "../common/Skeleton";
import EmptyState from "../common/EmptyState";
import KitchenManagementPanel from "./KitchenManagementPanel";
import KitchenDashboard from "./KitchenDashboard";
import MealFicheEditor from "./MealFicheEditor";
import MealClaimSelect from "./MealClaimSelect";
import MealSwapPanel, { type SwapRequest } from "./MealSwapPanel";
import ChefRoleSettings from "./ChefRoleSettings";

interface Props {
  eventId: string;
  data: KitchenViewData | null;
  swaps: SwapRequest[];
  loading: boolean;
  onChanged: () => void;
}

type Section = "gestion" | "mon-repas";

export default function KitchenTab({
  eventId,
  data,
  swaps,
  loading,
  onChanged: fetchKitchen,
}: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdminRights();
  const [section, setSection] = useState<Section>("gestion");
  const hasAutoSelected = useRef(false);

  // Point 5 : un utilisateur qui cumule responsable ET chef atterrit sur "Mon
  // repas" en premier. Ne s'execute qu'une fois (des que les donnees sont
  // chargees) pour ne pas ecraser un changement d'onglet manuel ulterieur.
  useEffect(() => {
    if (hasAutoSelected.current || !data) return;
    hasAutoSelected.current = true;
    if (data.currentUserKitchenRole === "manager" && data.isChef) {
      setSection("mon-repas");
    }
  }, [data]);

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
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-semibold">Cuisine</h1>
        <KitchenDashboard
          chefsCount={data.dashboard?.chefsCount ?? 0}
          coursesCount={data.dashboard?.coursesCount ?? 0}
          unassignedCount={data.dashboard?.unassignedCount ?? 0}
          equipierPlanningEnabled={data.equipierPlanningEnabled}
          meals={data.meals}
          chefs={data.dashboard?.chefs ?? []}
          coursesMembers={data.dashboard?.coursesMembers ?? []}
          unassigned={data.dashboard?.unassigned ?? []}
        />
      </div>
    );
  }

  const myMeal = data.meals.find((m) => m.chef?.id === user?.id) ?? null;
  const showManagement = isManager && (!isChefUser || section === "gestion");
  // Parcours chef : choisir un creneau de la grille tant qu'il n'a pas de repas,
  // puis proposer/recevoir un echange une fois son creneau reclame.
  const showChefTools = isChefUser && (!isManager || section === "mon-repas");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-serif text-2xl font-semibold">Cuisine</h1>
          {isManager && (
            <ChefRoleSettings
              eventId={eventId}
              chefRoleId={data.chefRoleId}
              onChanged={fetchKitchen}
            />
          )}
        </div>
        {isManager && isChefUser && (
          <div className="inline-flex gap-0.5 rounded-lg border border-base-300 bg-base-200 p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                section === "gestion"
                  ? "bg-base-100 font-semibold shadow-sm"
                  : "text-base-content/60 hover:text-base-content"
              }`}
              onClick={() => setSection("gestion")}
            >
              Gestion
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                section === "mon-repas"
                  ? "bg-base-100 font-semibold shadow-sm"
                  : "text-base-content/60 hover:text-base-content"
              }`}
              onClick={() => setSection("mon-repas")}
            >
              Mon repas
            </button>
          </div>
        )}
      </div>

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
          capacitySummary={data.capacitySummary}
          onChanged={fetchKitchen}
        />
      )}

      {showChefTools && (
        <div className="space-y-4">
          {/* Point 1 : allergies toujours visibles en haut de "Mon repas". */}
          {data.allergiesNotes && (
            <div className="alert alert-warning text-sm py-2">
              <span>Allergies : {data.allergiesNotes}</span>
            </div>
          )}

          {!myMeal && (
            <MealClaimSelect eventId={eventId} meals={data.meals} onClaimed={fetchKitchen} />
          )}

          {myMeal && <MealFicheEditor eventId={eventId} meal={myMeal} onChanged={fetchKitchen} />}

          {myMeal && user && (
            <MealSwapPanel
              eventId={eventId}
              meals={data.meals}
              currentUserId={user.id}
              swaps={swaps}
              onChanged={fetchKitchen}
            />
          )}
        </div>
      )}
    </div>
  );
}
