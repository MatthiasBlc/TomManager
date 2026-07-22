import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useConfirm } from "../../contexts/ConfirmContext";
import EmptyState from "../common/EmptyState";
import { getErrorMessage } from "../../config/apiErrors";
import MealFichesList, { type MealFiche } from "./MealFichesList";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface ChefEntry extends Person {
  source: "ROLE" | "MANUAL";
}

interface ConfigForm {
  chefRoleId: string;
  allergiesNotes: string;
  equipierPlanningEnabled: boolean;
}

interface Props {
  eventId: string;
  chefRoleId: string | null;
  allergiesNotes: string | null;
  equipierPlanningEnabled: boolean;
  chefs: ChefEntry[];
  coursesMembers: Person[];
  unassigned: Person[];
  meals: MealFiche[];
  capacitySummary?: { allocated: number; poolTotal: number };
  onChanged: () => void;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

export default function KitchenManagementPanel({
  eventId,
  chefRoleId,
  allergiesNotes,
  equipierPlanningEnabled,
  chefs,
  coursesMembers,
  unassigned,
  meals,
  capacitySummary,
  onChanged,
}: Props) {
  const confirmDialog = useConfirm();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedNewChef, setSelectedNewChef] = useState("");
  const [selectedNewCoursesMember, setSelectedNewCoursesMember] = useState("");

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ConfigForm>({
    defaultValues: {
      chefRoleId: chefRoleId ?? "",
      allergiesNotes: allergiesNotes ?? "",
      equipierPlanningEnabled,
    },
  });

  const isRoleMode = !!chefRoleId;

  const onSaveConfig = async (data: ConfigForm) => {
    const nextChefRoleId = data.chefRoleId.trim() || null;
    if (nextChefRoleId && nextChefRoleId !== chefRoleId) {
      const ok = await confirmDialog({
        title: "Activer le mode rôle Discord",
        message:
          "Les chefs ajoutés manuellement seront remplacés par les membres du rôle Discord. Leurs repas éventuels deviendront orphelins (conservés, à réassigner).",
        confirmLabel: "Activer",
        variant: "warning",
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/api/events/${eventId}/kitchen`, {
        chefRoleId: nextChefRoleId,
        allergiesNotes: data.allergiesNotes.trim() || null,
        equipierPlanningEnabled: data.equipierPlanningEnabled,
      });
      toast.success("Configuration mise à jour");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour de la configuration"));
    }
  };

  const handleAddChef = async () => {
    if (!selectedNewChef) return;
    setPendingAction("add-chef");
    try {
      await api.post(`/api/events/${eventId}/kitchen/chefs`, { userId: selectedNewChef });
      toast.success("Chef ajouté");
      setSelectedNewChef("");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'ajout du chef"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveChef = async (chef: ChefEntry) => {
    const ok = await confirmDialog({
      title: "Retirer le chef",
      message: `Retirer ${displayedName(chef)} des chefs ? Son éventuel repas deviendra orphelin (conservé, à réassigner).`,
      confirmLabel: "Retirer",
      variant: "warning",
    });
    if (!ok) return;
    setPendingAction(`remove-chef:${chef.id}`);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/chefs/${chef.id}`);
      toast.success(`${displayedName(chef)} retiré des chefs`);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec du retrait du chef"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleAddCoursesMember = async () => {
    if (!selectedNewCoursesMember) return;
    setPendingAction("add-courses");
    try {
      await api.post(`/api/events/${eventId}/kitchen/courses`, {
        userId: selectedNewCoursesMember,
      });
      toast.success("Ajouté à l'équipe courses");
      setSelectedNewCoursesMember("");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'ajout à l'équipe courses"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveCoursesMember = async (person: Person) => {
    setPendingAction(`remove-courses:${person.id}`);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/courses/${person.id}`);
      toast.success(`${displayedName(person)} retiré de l'équipe courses`);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec du retrait de l'équipe courses"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleGenerate = async () => {
    const ok = await confirmDialog({
      title: "Générer le planning",
      message:
        "Crée la grille des repas de l'événement (midi et soir) à partir des dates : le premier jour n'a qu'un dîner, le dernier jour aucun repas. Les créneaux déjà présents et les inscriptions sont conservés ; seules les places manquantes sont ajoutées.",
      confirmLabel: "Générer",
      variant: "warning",
    });
    if (!ok) return;
    setPendingAction("generate");
    try {
      const res = await api.post(`/api/events/${eventId}/kitchen/generate`);
      const { createdCount, overCapacity } = res.data.data;
      const base =
        createdCount > 0
          ? `Planning généré — ${createdCount} créneau(x) ajouté(s)`
          : "Planning déjà à jour — aucun créneau ajouté";
      if (overCapacity.length > 0) {
        toast.error(`${base} — ${overCapacity.length} repas en sur-occupation`);
      } else {
        toast.success(base);
      }
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la génération du planning"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleReset = async () => {
    const ok = await confirmDialog({
      title: "Réinitialiser le planning",
      message:
        "Supprime tous les repas de l'événement (plats, ingrédients, ustensiles, équipiers inscrits, échanges en cours). Les rosters chefs et équipe courses sont conservés. Cette action est irréversible.",
      confirmLabel: "Réinitialiser",
      variant: "danger",
    });
    if (!ok) return;
    setPendingAction("reset");
    try {
      await api.post(`/api/events/${eventId}/kitchen/reset`);
      toast.success("Planning réinitialisé");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la réinitialisation du planning"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card bg-base-200 shadow-none">
        <div className="card-body p-3">
          <h4 className="font-semibold text-sm mb-2">Configuration</h4>
          <form onSubmit={handleSubmit(onSaveConfig)} className="space-y-3">
            <div className="form-control">
              <label className="label" htmlFor="km-chefRoleId">
                <span className="label-text">ID du rôle Discord des chefs</span>
                <span className="label-text-alt opacity-50">vide = mode manuel</span>
              </label>
              <input
                id="km-chefRoleId"
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="Snowflake Discord"
                {...register("chefRoleId")}
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="km-allergies">
                <span className="label-text">Notes allergies</span>
              </label>
              <textarea
                id="km-allergies"
                className="textarea textarea-bordered w-full"
                rows={3}
                maxLength={5000}
                {...register("allergiesNotes")}
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-primary rounded-md"
                {...register("equipierPlanningEnabled")}
              />
              <span className="label-text">Afficher le planning cuisine aux équipiers</span>
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
              {isSubmitting && <span className="loading loading-spinner loading-xs" />}
              Enregistrer
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <h4 className="font-semibold text-sm mb-2">
              Chefs {isRoleMode && <span className="badge badge-ghost badge-sm">rôle Discord</span>}
            </h4>
            {chefs.length === 0 ? (
              <p className="text-xs opacity-60">Aucun chef pour l'instant.</p>
            ) : (
              <ul className="divide-y divide-base-300">
                {chefs.map((chef) => (
                  <li key={chef.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm">{displayedName(chef)}</span>
                    {!isRoleMode && (
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        disabled={!!pendingAction}
                        onClick={() => handleRemoveChef(chef)}
                      >
                        {pendingAction === `remove-chef:${chef.id}` && (
                          <span className="loading loading-spinner loading-xs" />
                        )}
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!isRoleMode && (
              <div className="flex gap-2 mt-3">
                <select
                  className="select select-bordered select-sm flex-1"
                  value={selectedNewChef}
                  onChange={(e) => setSelectedNewChef(e.target.value)}
                >
                  <option value="">Choisir un participant...</option>
                  {unassigned.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayedName(p)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-sm"
                  disabled={!selectedNewChef || !!pendingAction}
                  onClick={handleAddChef}
                >
                  {pendingAction === "add-chef" && (
                    <span className="loading loading-spinner loading-xs" />
                  )}
                  Ajouter
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <h4 className="font-semibold text-sm mb-2">Équipe courses ({coursesMembers.length})</h4>
            {coursesMembers.length === 0 ? (
              <p className="text-xs opacity-60">Aucun membre pour l'instant.</p>
            ) : (
              <ul className="divide-y divide-base-300">
                {coursesMembers.map((p) => (
                  <li key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm">{displayedName(p)}</span>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      disabled={!!pendingAction}
                      onClick={() => handleRemoveCoursesMember(p)}
                    >
                      {pendingAction === `remove-courses:${p.id}` && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 mt-3">
              <select
                className="select select-bordered select-sm flex-1"
                value={selectedNewCoursesMember}
                onChange={(e) => setSelectedNewCoursesMember(e.target.value)}
              >
                <option value="">Choisir un participant...</option>
                {unassigned.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayedName(p)}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-sm"
                disabled={!selectedNewCoursesMember || !!pendingAction}
                onClick={handleAddCoursesMember}
              >
                {pendingAction === "add-courses" && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Ajouter
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <h4 className="font-semibold text-sm mb-2">Sans affectation ({unassigned.length})</h4>
            {unassigned.length === 0 ? (
              <p className="text-xs opacity-60">Tout le monde a un rôle cuisine.</p>
            ) : (
              <p className="text-xs opacity-80">{unassigned.map(displayedName).join(", ")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-200 shadow-none">
        <div className="card-body p-3">
          <h4 className="font-semibold text-sm mb-2">Planning</h4>
          <p className="text-xs opacity-70 mb-2">
            Génère la grille des repas (midi/soir) depuis les dates de l'événement et répartit les
            places d'équipiers entre les créneaux. Le chef/l'équipier de chaque repas s'assigne
            ensuite depuis les fiches ci-dessous.
          </p>
          {capacitySummary && (
            <div
              className={`flex flex-wrap items-center gap-2 mb-2 p-2 rounded-lg ${
                capacitySummary.allocated > capacitySummary.poolTotal
                  ? "bg-error/10"
                  : "bg-base-100"
              }`}
            >
              <span
                className={`text-lg font-semibold ${
                  capacitySummary.allocated > capacitySummary.poolTotal ? "text-error" : ""
                }`}
              >
                Équipiers répartis : {capacitySummary.allocated}/{capacitySummary.poolTotal}
              </span>
              {capacitySummary.allocated > capacitySummary.poolTotal && (
                <span className="badge badge-error badge-sm">⚠ sur-allocation</span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {meals.length === 0 ? (
              <button
                className="btn btn-warning btn-sm"
                disabled={!!pendingAction}
                onClick={handleGenerate}
              >
                {pendingAction === "generate" && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Générer le planning
              </button>
            ) : (
              <button
                className="btn btn-error btn-outline btn-sm"
                disabled={!!pendingAction}
                onClick={handleReset}
              >
                {pendingAction === "reset" && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Réinitialiser le planning
              </button>
            )}
          </div>
        </div>
      </div>

      {chefs.length === 0 && coursesMembers.length === 0 && unassigned.length === 0 && (
        <EmptyState icon={<span>🍳</span>} title="Aucun participant sur cet événement" />
      )}

      <div>
        {/* Point 2 : le responsable voit et edite toutes les fiches ici (Gestion),
            jamais dans "Mon repas" (reserve a la seule fiche du chef). */}
        <h4 className="font-semibold text-sm mb-2">Fiches repas</h4>
        <MealFichesList
          eventId={eventId}
          meals={meals}
          chefs={chefs}
          unassigned={unassigned}
          capacitySummary={capacitySummary}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
