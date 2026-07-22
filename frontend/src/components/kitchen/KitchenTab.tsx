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
    );
  }

  const myMeal = data.meals.find((m) => m.chef?.id === user?.id) ?? null;
  const showManagement = isManager && (!isChefUser || section === "gestion");
  // Parcours chef : choisir un creneau de la grille tant qu'il n'a pas de repas,
  // puis proposer/recevoir un echange une fois son creneau reclame.
  const showChefTools = isChefUser && (!isManager || section === "mon-repas");

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
