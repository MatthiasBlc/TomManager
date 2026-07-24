import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useConfirm } from "../../contexts/ConfirmContext";
import EmptyState from "../common/EmptyState";
import { getErrorMessage } from "../../config/apiErrors";
import MealFichesList, { type MealFiche } from "./MealFichesList";
import PersonAvatar from "../common/PersonAvatar";
import { CARD, SectionEyebrow } from "../common/ui";
import {
  AlertTriangleIcon,
  PencilIcon,
  CalendarIcon,
  UsersIcon,
  UtensilsIcon,
  EyeIcon,
  EyeOffIcon,
} from "../common/icons";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface ChefEntry extends Person {
  source: "ROLE" | "MANUAL";
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

// Bloc allergies : editable directement ici (bouton crayon) plutot que noye
// dans un formulaire de config generique. Etat vide distinct (gris, non
// alarmant) tant qu'aucune note n'est renseignee.
function AllergyNotesCard({
  eventId,
  allergiesNotes,
  onChanged,
}: {
  eventId: string;
  allergiesNotes: string | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(allergiesNotes ?? "");
  const [saving, setSaving] = useState(false);
  const hasNotes = !!allergiesNotes?.trim();

  const startEditing = () => {
    setDraft(allergiesNotes ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/events/${eventId}/kitchen`, {
        allergiesNotes: draft.trim() || null,
      });
      toast.success("Notes allergies mises à jour");
      setEditing(false);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour des notes allergies"));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`${CARD} border-dashed`}>
        <div className="card-body p-3 space-y-2">
          <label className="label-text text-sm font-medium" htmlFor="km-allergies-input">
            Notes allergies
          </label>
          <textarea
            id="km-allergies-input"
            className="textarea textarea-bordered w-full text-sm"
            rows={3}
            maxLength={5000}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex : une convive est allergique aux fruits à coque"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={handleSave}
            >
              {saving && <span className="loading loading-spinner loading-xs" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card shadow-[0_1px_2px_rgba(0,0,0,.3),0_10px_24px_-12px_rgba(0,0,0,.5)] border ${
        hasNotes ? "bg-error/10 border-error/30" : "bg-base-200 border-dashed border-base-300"
      }`}
    >
      <div className="card-body p-3 flex-row items-start gap-3">
        <AlertTriangleIcon
          className={`w-5 h-5 shrink-0 mt-0.5 ${hasNotes ? "text-error" : "opacity-40"}`}
        />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${hasNotes ? "text-error" : "opacity-60"}`}>
            {hasNotes ? "Allergie à signaler aux équipes" : "Notes allergies"}
          </p>
          <p className={`text-sm ${hasNotes ? "" : "opacity-50 italic"}`}>
            {hasNotes ? allergiesNotes : "Aucune allergie renseignée pour le moment."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-square btn-sm"
          onClick={startEditing}
          aria-label="Modifier les notes allergies"
          title="Modifier"
        >
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}

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

  const isRoleMode = !!chefRoleId;

  const handleTogglePublish = async (next: boolean) => {
    setPendingAction("publish");
    try {
      await api.patch(`/api/events/${eventId}/kitchen`, { equipierPlanningEnabled: next });
      toast.success(next ? "Planning publié aux équipiers" : "Planning masqué aux équipiers");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour de la visibilité"));
    } finally {
      setPendingAction(null);
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
      <AllergyNotesCard eventId={eventId} allergiesNotes={allergiesNotes} onChanged={onChanged} />

      <div>
        <SectionEyebrow icon={<CalendarIcon />}>État du planning</SectionEyebrow>
        <div className={CARD}>
          <div className="card-body p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-base-300">
              <div className="flex items-center gap-2">
                <span
                  className={`badge gap-1 ${equipierPlanningEnabled ? "badge-success" : "badge-warning"}`}
                >
                  {equipierPlanningEnabled ? <EyeIcon /> : <EyeOffIcon />}
                  {equipierPlanningEnabled ? "Publié" : "Non publié"}
                </span>
                <span className="text-xs opacity-70">
                  {equipierPlanningEnabled
                    ? "Les équipiers voient ce planning."
                    : "Les équipiers ne voient pas encore ce planning."}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-medium">Visible par les équipiers</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-success"
                  checked={equipierPlanningEnabled}
                  disabled={pendingAction === "publish"}
                  onChange={(e) => handleTogglePublish(e.target.checked)}
                  aria-label="Rendre le planning visible par les équipiers"
                />
              </label>
            </div>

            {capacitySummary ? (
              (() => {
                const over = capacitySummary.allocated > capacitySummary.poolTotal;
                const pct =
                  capacitySummary.poolTotal > 0
                    ? Math.min(100, (capacitySummary.allocated / capacitySummary.poolTotal) * 100)
                    : 0;
                const overflowCount = capacitySummary.allocated - capacitySummary.poolTotal;
                return (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <div className="min-w-[120px]" data-testid="capacity-summary">
                      <div
                        className={`font-serif text-3xl font-semibold leading-none tabular-nums ${over ? "text-error" : ""}`}
                      >
                        {capacitySummary.allocated}
                        <span className="text-lg font-normal opacity-50">
                          {" "}
                          / {capacitySummary.poolTotal}
                        </span>
                      </div>
                      <div className="text-xs opacity-60 mt-1">équipiers affectés</div>
                    </div>
                    <div>
                      <div className="h-2 w-full rounded-full bg-base-300 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${over ? "bg-error" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs opacity-50 mt-1 tabular-nums">
                        <span>0</span>
                        <span>capacité : {capacitySummary.poolTotal}</span>
                      </div>
                      {over && (
                        <p className="text-sm opacity-80 mt-2">
                          <b className="text-error">
                            Sur-allocation : {overflowCount} équipier{overflowCount > 1 ? "s" : ""}
                          </b>{" "}
                          sont placés sur plusieurs créneaux en même temps. Vérifiez les fiches
                          repas avant de publier.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
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
                );
              })()
            ) : (
              <>
                <p className="text-xs opacity-70 mb-2">
                  Génère la grille des repas (midi/soir) depuis les dates de l'événement et répartit
                  les places d'équipiers entre les créneaux. Le chef/l'équipier de chaque repas
                  s'assigne ensuite depuis les fiches ci-dessous.
                </p>
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
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionEyebrow icon={<UsersIcon />}>Équipe cuisine</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className={CARD}>
            <div className="card-body p-3">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                Chefs
                {isRoleMode && <span className="badge badge-ghost badge-sm">rôle Discord</span>}
              </h4>
              {chefs.length === 0 ? (
                <p className="text-xs opacity-60">Aucun chef pour l'instant.</p>
              ) : (
                <ul className="divide-y divide-base-300">
                  {chefs.map((chef) => (
                    <li key={chef.id} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm">
                        <PersonAvatar name={displayedName(chef)} />
                        {displayedName(chef)}
                      </span>
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

          <div className={CARD}>
            <div className="card-body p-3">
              <h4 className="font-semibold text-sm mb-2">
                Équipe courses ({coursesMembers.length})
              </h4>
              {coursesMembers.length === 0 ? (
                <p className="text-xs opacity-60">Aucun membre pour l'instant.</p>
              ) : (
                <ul className="divide-y divide-base-300">
                  {coursesMembers.map((p) => (
                    <li key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm">
                        <PersonAvatar name={displayedName(p)} />
                        {displayedName(p)}
                      </span>
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

          <div className={CARD}>
            <div className="card-body p-3">
              <h4 className="font-semibold text-sm mb-2">Sans affectation ({unassigned.length})</h4>
              {unassigned.length === 0 ? (
                <p className="text-xs opacity-60">Tout le monde a un rôle cuisine.</p>
              ) : (
                <ul className="divide-y divide-base-300 max-h-[13.5rem] overflow-y-auto pr-1">
                  {unassigned.map((p) => (
                    <li key={p.id} className="py-1.5">
                      <span className="flex items-center gap-2 text-sm">
                        <PersonAvatar name={displayedName(p)} />
                        {displayedName(p)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {chefs.length === 0 && coursesMembers.length === 0 && unassigned.length === 0 && (
          <EmptyState icon={<span>🍳</span>} title="Aucun participant sur cet événement" />
        )}
      </div>

      <div>
        {/* Point 2 : le responsable voit et edite toutes les fiches ici (Gestion),
            jamais dans "Mon repas" (reserve a la seule fiche du chef). */}
        <SectionEyebrow icon={<UtensilsIcon />}>Fiches repas</SectionEyebrow>
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
