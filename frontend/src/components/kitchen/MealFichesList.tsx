import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { getErrorMessage } from "../../config/apiErrors";
import EmptyState from "../common/EmptyState";
import NumberStepper from "../common/NumberStepper";
import { serviceLabel } from "./units";
import { formatParisDate } from "../../utils/dateTime";
import MealFicheDetailModal from "./MealFicheDetailModal";
import PersonAvatar from "../common/PersonAvatar";
import { AlertTriangleIcon, CheckIcon, CloseIcon } from "../common/icons";

// Label court "jour . service" (ex: "vendredi . Soir"), affiche en petites
// majuscules au-dessus du nom du plat (cf. maquette Cuisine).
const whenLabel = (meal: { service: string; startDateTime: string }) =>
  `${formatParisDate(meal.startDateTime, { weekday: "long" })} · ${serviceLabel(meal.service)}`;

export interface MealFiche {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  maxAssistants: number;
  // Absents si l'utilisateur courant ne voit pas la repartition (equipier) : chef,
  // responsable et admin simple uniquement.
  vegeCount?: number;
  carneCount?: number;
  chef: { id: string; username: string; displayName?: string | null } | null;
  assistants: { id: string; username: string; displayName?: string | null }[];
  remainingSeats: number;
  ingredients?: { name: string; quantity: number; unit: string; note?: string | null }[];
  utensils?: { name: string }[];
  // Bloc-notes libre du chef (recette collee, deroule, remarques). Meme perimetre de
  // lecture que les ingredients : absent pour un equipier.
  recipe?: string | null;
}

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
  meals: MealFiche[];
  chefs: ChefEntry[];
  unassigned: Person[];
  capacitySummary?: { allocated: number; poolTotal: number };
  eventParticipantsCount?: number;
  onChanged: () => void;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

// Champs edites "en direct" sur la carte (capacite equipiers + repartition vege/carne) :
// un PATCH par clic gelait l'UI (le temps de 2 refetch : reponse + socket) et generait
// une notification chef par increment. On accumule donc un brouillon local envoye une
// seule fois, une fois la saisie stabilisee.
const SAVE_DEBOUNCE_MS = 800;

interface MealDraft {
  maxAssistants?: number;
  vegeCount?: number;
  carneCount?: number;
}

// Liste des fiches repas, section Gestion (Admin Chef, spec CookV1 5) : creneau non
// editable/non supprimable, chef/capacite/equipiers actionnables directement sur la
// ligne. Le detail (nom du plat, ingredients, ustensiles) s'edite dans la modale
// "details" -> "modifier" -> "valider" (MealFicheDetailModal).
export default function MealFichesList({
  eventId,
  meals,
  chefs,
  unassigned,
  capacitySummary,
  eventParticipantsCount,
  onChanged,
}: Props) {
  const [detailMeal, setDetailMeal] = useState<MealFiche | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [chefChoices, setChefChoices] = useState<Record<string, string>>({});
  const [equipierChoices, setEquipierChoices] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, MealDraft>>({});
  const draftsRef = useRef<Record<string, MealDraft>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const applyDrafts = (next: Record<string, MealDraft>) => {
    draftsRef.current = next;
    setDrafts(next);
  };

  const dropDraft = (mealId: string) => {
    const rest = { ...draftsRef.current };
    delete rest[mealId];
    applyDrafts(rest);
  };

  // Le brouillon s'efface quand les donnees serveur l'ont rattrape, jamais des la reponse
  // du PATCH : sinon la carte re-affiche brievement l'ancienne valeur en attendant le
  // refetch (clignotement).
  useEffect(() => {
    let changed = false;
    const next = { ...draftsRef.current };
    for (const meal of meals) {
      const draft = next[meal.id];
      if (!draft) continue;
      const settled =
        (draft.maxAssistants === undefined || draft.maxAssistants === meal.maxAssistants) &&
        (draft.vegeCount === undefined || draft.vegeCount === (meal.vegeCount ?? 0)) &&
        (draft.carneCount === undefined || draft.carneCount === (meal.carneCount ?? 0));
      if (settled) {
        delete next[meal.id];
        changed = true;
      }
    }
    if (changed) applyDrafts(next);
  }, [meals]);

  // Filet de securite au demontage (changement d'onglet, sortie de l'evenement) : le
  // debounce ne doit jamais faire perdre une saisie, on envoie donc les brouillons encore
  // en attente. Pas de onChanged() ici, le composant n'est plus la pour l'exploiter.
  useEffect(() => {
    // `timersRef.current` n'est jamais reassigne (mutation en place), le capturer est sur.
    // `draftsRef.current` l'est a chaque saisie : il doit etre lu dans le cleanup, sinon on
    // n'aurait que l'objet vide du montage.
    const timers = timersRef.current;
    return () => {
      for (const [mealId, timer] of Object.entries(timers)) {
        clearTimeout(timer);
        const payload = draftsRef.current[mealId];
        if (payload) {
          api
            .patch(`/api/events/${eventId}/kitchen/meals/${mealId}`, payload)
            .catch(() => undefined);
        }
      }
    };
  }, [eventId]);

  if (meals.length === 0) {
    return (
      <EmptyState
        icon={<span>🍽️</span>}
        title="Aucune fiche repas pour l'instant"
        description="Génère le planning pour commencer."
      />
    );
  }

  // Chefs du roster pas encore sur un creneau (memes donnees que l'ancienne carte
  // "Repas orphelins", repliees dans chaque ligne pour eviter la duplication).
  const assignedChefIds = new Set(meals.filter((m) => m.chef).map((m) => m.chef!.id));
  const eligibleChefs = chefs.filter((c) => !assignedChefIds.has(c.id));
  const poolRemaining = capacitySummary
    ? Math.max(0, capacitySummary.poolTotal - capacitySummary.allocated)
    : undefined;

  const handleAssignChef = async (meal: MealFiche) => {
    const chefId = chefChoices[meal.id];
    if (!chefId) return;
    setPendingAction(`chef:${meal.id}`);
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, { chefUserId: chefId });
      toast.success("Chef assigné");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'assignation du chef"));
    } finally {
      setPendingAction(null);
    }
  };

  // Envoi differe du brouillon accumule pour une carte : un seul PATCH groupe une fois la
  // saisie stabilisee, quel que soit le nombre de clics ou de frappes.
  const flushDraft = async (mealId: string) => {
    delete timersRef.current[mealId];
    const payload = draftsRef.current[mealId];
    if (!payload) return;
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${mealId}`, payload);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour de la fiche repas"));
      // Retour a la valeur serveur : le brouillon refuse ne doit pas rester affiche.
      dropDraft(mealId);
      onChanged();
    }
  };

  const scheduleDraft = (mealId: string, patch: MealDraft) => {
    applyDrafts({
      ...draftsRef.current,
      [mealId]: { ...draftsRef.current[mealId], ...patch },
    });
    clearTimeout(timersRef.current[mealId]);
    timersRef.current[mealId] = setTimeout(() => flushDraft(mealId), SAVE_DEBOUNCE_MS);
  };

  const handleCapacityChange = (meal: MealFiche, value: number) => {
    scheduleDraft(meal.id, { maxAssistants: value });
  };

  // Auto-equilibrage (spec KitchenDietSplit) : editer un des deux champs recalcule
  // l'autre pour que la somme colle toujours a eventParticipantsCount au moment de
  // l'edition. Les deux valeurs partent dans le meme PATCH pour rester coherentes (et
  // ne produire qu'une notification chef avec le bon old/new, cf backend updateMeal).
  const handleDietSplitChange = (meal: MealFiche, field: "vege" | "carne", value: number) => {
    const target = eventParticipantsCount ?? 0;
    const clamped = Math.max(0, Math.min(target, value));
    scheduleDraft(meal.id, {
      vegeCount: field === "vege" ? clamped : target - clamped,
      carneCount: field === "carne" ? clamped : target - clamped,
    });
  };

  const handleAddAssistant = async (meal: MealFiche) => {
    const userId = equipierChoices[meal.id];
    if (!userId) return;
    setPendingAction(`add-assistant:${meal.id}`);
    try {
      await api.post(`/api/events/${eventId}/kitchen/meals/${meal.id}/assistants/${userId}`);
      toast.success("Équipier ajouté");
      setEquipierChoices((prev) => ({ ...prev, [meal.id]: "" }));
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'ajout de l'équipier"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveAssistant = async (meal: MealFiche, userId: string) => {
    setPendingAction(`remove-assistant:${meal.id}:${userId}`);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/meals/${meal.id}/assistants/${userId}`);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec du retrait de l'équipier"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {meals.map((meal) => {
          // Valeurs affichees = brouillon local en cours de saisie, sinon donnee serveur.
          const draft = drafts[meal.id];
          const maxAssistants = draft?.maxAssistants ?? meal.maxAssistants;
          const isDraftPending = draft !== undefined;
          const capacityMax =
            poolRemaining !== undefined ? meal.maxAssistants + poolRemaining : undefined;
          // Statut prioritaire de la fiche : un chef manquant est l'info la plus
          // urgente (accent chaud), devant la simple occupation des places.
          const needsChef = !meal.chef;
          const isComplete = meal.remainingSeats === 0;
          const borderClass = needsChef
            ? "border-l-4 border-l-warning"
            : isComplete
              ? "border-l-4 border-l-success"
              : "border-l-4 border-l-info";
          return (
            <div
              key={meal.id}
              className={`card bg-base-200 border border-base-300 shadow-[0_1px_2px_rgba(0,0,0,.3),0_10px_24px_-12px_rgba(0,0,0,.5)] cursor-pointer hover:bg-base-300 transition-colors ${borderClass}`}
              onClick={() => setDetailMeal(meal)}
            >
              <div className="card-body p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-wider font-bold opacity-50">
                      {whenLabel(meal)}
                    </p>
                    <p className="font-serif text-lg font-semibold leading-tight mt-0.5">
                      {meal.name || whenLabel(meal)}
                    </p>
                  </div>
                  {needsChef ? (
                    <span className="badge badge-warning badge-sm shrink-0 gap-1">
                      <AlertTriangleIcon className="w-3 h-3" />
                      Chef à assigner
                    </span>
                  ) : isComplete ? (
                    <span className="badge badge-success badge-sm shrink-0 gap-1">
                      <CheckIcon />
                      Complet
                    </span>
                  ) : (
                    <span className="badge badge-info badge-sm shrink-0">
                      {meal.remainingSeats} place{meal.remainingSeats > 1 ? "s" : ""} libre
                      {meal.remainingSeats > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="h-px bg-base-300" />

                <div
                  className="flex items-center gap-2 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[0.71rem] uppercase tracking-wide font-bold opacity-50 w-16 shrink-0">
                    Chef
                  </span>
                  {meal.chef ? (
                    <span className="flex items-center gap-2 text-sm">
                      <PersonAvatar name={displayedName(meal.chef)} />
                      {displayedName(meal.chef)}
                    </span>
                  ) : (
                    <div className="flex gap-2 flex-1 min-w-[200px]">
                      <select
                        className="select select-bordered select-xs flex-1"
                        value={chefChoices[meal.id] ?? ""}
                        onChange={(e) =>
                          setChefChoices((prev) => ({ ...prev, [meal.id]: e.target.value }))
                        }
                        disabled={eligibleChefs.length === 0}
                      >
                        <option value="">Choisir un chef...</option>
                        {eligibleChefs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {displayedName(c)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-xs"
                        disabled={!chefChoices[meal.id] || !!pendingAction}
                        onClick={() => handleAssignChef(meal)}
                      >
                        Assigner
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[0.71rem] uppercase tracking-wide font-bold opacity-50 w-16 shrink-0">
                    Places
                  </span>
                  <div className="flex-1 min-w-[70px]">
                    <div className="h-1.5 w-full rounded-full bg-base-300 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-info"}`}
                        style={{
                          width: `${
                            maxAssistants > 0
                              ? Math.min(100, (meal.assistants.length / maxAssistants) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="text-xs opacity-50 mt-1 tabular-nums">
                      {meal.assistants.length} / {maxAssistants} pourvues
                    </div>
                  </div>
                  <NumberStepper
                    value={maxAssistants}
                    min={meal.assistants.length}
                    max={capacityMax}
                    aria-label="Nombre de places équipiers"
                    onChange={(v) => handleCapacityChange(meal, v)}
                  />
                </div>

                {(() => {
                  const vege = draft?.vegeCount ?? meal.vegeCount ?? 0;
                  const carne = draft?.carneCount ?? meal.carneCount ?? 0;
                  const target = eventParticipantsCount ?? 0;
                  const sum = vege + carne;
                  const mismatch = sum !== target;
                  const vegePct = sum > 0 ? (vege / sum) * 100 : 0;
                  return (
                    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[0.71rem] uppercase tracking-wide font-bold opacity-50 w-16 shrink-0">
                          Repas
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs opacity-70">🌱</span>
                          <NumberStepper
                            value={vege}
                            max={target}
                            aria-label="Nombre de repas végé"
                            onChange={(v) => handleDietSplitChange(meal, "vege", v)}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs opacity-70">🥩</span>
                          <NumberStepper
                            value={carne}
                            max={target}
                            aria-label="Nombre de repas carné"
                            onChange={(v) => handleDietSplitChange(meal, "carne", v)}
                          />
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-base-300 overflow-hidden flex">
                        <div className="h-full bg-success" style={{ width: `${vegePct}%` }} />
                        <div className="h-full bg-warning" style={{ width: `${100 - vegePct}%` }} />
                      </div>
                      {mismatch ? (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                          <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                          Somme = {sum}, attendu {target} participant{target > 1 ? "s" : ""}. À
                          corriger.
                        </p>
                      ) : (
                        <p className="text-xs opacity-50 tabular-nums">
                          {vege} végé / {carne} carné —{" "}
                          {isDraftPending ? "enregistrement…" : "à jour"}
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[0.71rem] uppercase tracking-wide font-bold opacity-50">
                    Équipiers
                  </span>
                  {meal.assistants.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {meal.assistants.map((a) => (
                        <span key={a.id} className="badge badge-ghost gap-1.5">
                          {displayedName(a)}
                          <button
                            type="button"
                            className="opacity-70 hover:opacity-100 hover:text-error transition-colors"
                            disabled={!!pendingAction}
                            onClick={() => handleRemoveAssistant(meal, a.id)}
                            aria-label={`Retirer ${displayedName(a)}`}
                          >
                            <CloseIcon />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <span className="badge badge-ghost border-dashed opacity-60">
                        Aucun équipier
                      </span>
                    </div>
                  )}
                  {meal.remainingSeats > 0 && (
                    <div className="flex gap-2">
                      <select
                        className="select select-bordered select-xs flex-1"
                        value={equipierChoices[meal.id] ?? ""}
                        onChange={(e) =>
                          setEquipierChoices((prev) => ({ ...prev, [meal.id]: e.target.value }))
                        }
                        disabled={unassigned.length === 0}
                      >
                        <option value="">Choisir un équipier...</option>
                        {unassigned.map((p) => (
                          <option key={p.id} value={p.id}>
                            {displayedName(p)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-xs"
                        disabled={!equipierChoices[meal.id] || !!pendingAction}
                        onClick={() => handleAddAssistant(meal)}
                      >
                        Ajouter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MealFicheDetailModal
        eventId={eventId}
        meal={detailMeal}
        onClose={() => setDetailMeal(null)}
        onChanged={onChanged}
      />
    </>
  );
}
