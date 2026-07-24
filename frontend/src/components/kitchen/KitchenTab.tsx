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
import { EyeIcon } from "../common/icons";

interface Props {
  eventId: string;
  data: KitchenViewData | null;
  swaps: SwapRequest[];
  loading: boolean;
  onChanged: () => void;
}

// "gestion" (responsable) et "vue-ensemble" (admin sans droit de gestion) sont
// mutuellement exclusifs (cf isManager/hasVueEnsemble ci-dessous) : au plus une
// des deux est disponible en meme temps que "mon-repas".
type Section = "gestion" | "vue-ensemble" | "mon-repas";

export default function KitchenTab({
  eventId,
  data,
  swaps,
  loading,
  onChanged: fetchKitchen,
}: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdminRights();
  // null = pas encore de choix explicite (clic ou auto-selection point 5) :
  // activeSection retombe alors sur primarySection, jamais sur une valeur figee
  // qui pourrait ne pas correspondre au role reel de l'utilisateur (evite un
  // flash de "Gestion" pour un admin+chef qui n'est pas responsable).
  const [section, setSection] = useState<Section | null>(null);
  const hasAutoSelected = useRef(false);

  // Point 5 : un utilisateur qui cumule un acces admin/responsable ET chef
  // atterrit sur "Mon repas" en premier (c'est probablement pourquoi il vient).
  // Ne s'execute qu'une fois (des que les donnees sont chargees) pour ne pas
  // ecraser un changement d'onglet manuel ulterieur.
  useEffect(() => {
    if (hasAutoSelected.current || !data) return;
    hasAutoSelected.current = true;
    const managerRole = data.currentUserKitchenRole === "manager";
    if (data.isChef && (managerRole || isAdmin)) {
      setSection("mon-repas");
    }
  }, [data, isAdmin]);

  if (loading) return <SkeletonCardGrid count={2} />;
  if (!data) return null;

  const isManager = data.currentUserKitchenRole === "manager";
  const isChefUser = data.isChef;
  // Un admin garde son acces "vue d'ensemble" meme s'il est par ailleurs chef :
  // les deux roles se cumulent, ne s'excluent plus (cf KitchenDashboard).
  // Redondant si responsable (Gestion couvre deja tout ce que montre la vue
  // d'ensemble, et plus), d'ou le !isManager.
  const hasVueEnsemble = isAdmin && !isManager;
  const canSeeTab = isManager || hasVueEnsemble || isChefUser;

  if (!canSeeTab) {
    return (
      <EmptyState
        icon={<span>🍳</span>}
        title="Section réservée aux chefs et responsables cuisine"
        description="Retrouve le planning des repas dans l'onglet Infos si le responsable l'a activé."
      />
    );
  }

  const primarySection: "gestion" | "vue-ensemble" | null = isManager
    ? "gestion"
    : hasVueEnsemble
      ? "vue-ensemble"
      : null;
  const showSelector = primarySection !== null && isChefUser;
  const activeSection: Section = section ?? primarySection ?? "mon-repas";
  const primaryLabel = primarySection === "gestion" ? "Gestion" : "Vue d'ensemble";

  const myMeal = data.meals.find((m) => m.chef?.id === user?.id) ?? null;
  const showManagement = activeSection === "gestion";
  const showVueEnsemble = activeSection === "vue-ensemble";
  // Parcours chef : choisir un creneau de la grille tant qu'il n'a pas de repas,
  // puis proposer/recevoir un echange une fois son creneau reclame.
  const showChefTools = activeSection === "mon-repas";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl font-semibold">Cuisine</h1>
            {showVueEnsemble && (
              <span className="badge badge-ghost gap-1 text-xs font-bold uppercase tracking-wide">
                <EyeIcon />
                Vue d'ensemble
              </span>
            )}
          </div>
          {isManager && (
            <ChefRoleSettings
              eventId={eventId}
              chefRoleId={data.chefRoleId}
              onChanged={fetchKitchen}
            />
          )}
        </div>
        {showVueEnsemble && (
          <p className="text-sm opacity-60">
            Vous n'êtes pas responsable cuisine sur cet événement : lecture seule.
          </p>
        )}
        {showSelector && (
          <div className="inline-flex gap-0.5 rounded-lg border border-base-300 bg-base-200 p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeSection === primarySection
                  ? "bg-base-100 font-semibold shadow-sm"
                  : "text-base-content/60 hover:text-base-content"
              }`}
              onClick={() => setSection(primarySection as Section)}
            >
              {primaryLabel}
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeSection === "mon-repas"
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

      {showVueEnsemble && (
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
