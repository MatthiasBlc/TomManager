import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { getErrorMessage } from "../../config/apiErrors";
import { useDebouncedSave, type SaveStatus } from "../../hooks/useDebouncedSave";
import IngredientListInput, { type IngredientRow } from "./IngredientListInput";
import UtensilListInput from "./UtensilListInput";
import { serviceLabel, dayLabel, SERVICE_ICONS } from "./units";
import { formatParisTime } from "../../utils/dateTime";
import type { MealFiche } from "./MealFichesList";

interface Props {
  eventId: string;
  meal: MealFiche;
  eventParticipantsCount?: number;
  onChanged: () => void;
}

const displayedName = (u: { username: string; displayName?: string | null }) =>
  u.displayName ?? u.username;

function FieldStatus({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <span className="loading loading-spinner loading-xs opacity-60 ml-1" />;
  }
  if (status === "saved") {
    return (
      <span className="text-success text-xs ml-1" aria-label="Enregistré">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-error text-xs ml-1" aria-label="Échec de l'enregistrement">
        ⚠
      </span>
    );
  }
  return null;
}

const LIST_SAVE_DEBOUNCE_MS = 1200;
// Aligne sur la validation backend (updateMealSchema.recipe).
const RECIPE_MAX_LENGTH = 10000;

const toIngredientRows = (ingredients: MealFiche["ingredients"]): IngredientRow[] =>
  (ingredients ?? []).map((i) => ({
    name: i.name,
    quantity: Number(i.quantity),
    unit: i.unit as IngredientRow["unit"],
    note: i.note ?? "",
  }));

// Fiche repas editable "a la volee" (Evolutions.md point 1) : chaque champ
// s'auto-sauvegarde individuellement via PATCH partiel, jamais de bouton
// "Enregistrer". Utilise uniquement dans "Mon repas" (le chef n'edite que
// nom/ingredients/ustensiles de son propre creneau) ; la Gestion (manager) utilise
// desormais la liste de fiches dediee (MealFichesList) pour chef/capacite/equipiers,
// y compris la suppression du creneau : un chef ne peut pas supprimer son propre
// repas depuis "Mon repas" (ca desinscrirait les equipiers deja rejoints).
export default function MealFicheEditor({
  eventId,
  meal,
  eventParticipantsCount,
  onChanged,
}: Props) {
  const [name, setName] = useState(meal.name);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    toIngredientRows(meal.ingredients)
  );
  const [utensils, setUtensils] = useState<string[]>((meal.utensils ?? []).map((u) => u.name));
  const [recipe, setRecipe] = useState(meal.recipe ?? "");

  // Reinitialise les champs uniquement quand on change de repas (pas a chaque
  // refetch du meme repas) : ne jamais ecraser une saisie en cours.
  useEffect(() => {
    setName(meal.name);
    setIngredients(toIngredientRows(meal.ingredients));
    setUtensils((meal.utensils ?? []).map((u) => u.name));
    setRecipe(meal.recipe ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  const patchMeal = async (payload: Record<string, unknown>) => {
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, payload);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'enregistrement"));
      throw err;
    }
  };

  const nameStatus = useDebouncedSave(name, (v) => patchMeal({ name: v }));
  // Les listes se saisissent par rafales (une ligne apres l'autre) et chaque PATCH
  // reecrit la liste entiere : un debounce plus long qu'un champ texte simple evite
  // d'emettre une ecriture par mot tape (retour prod : rafale de 429). Le filet de
  // securite au demontage de useDebouncedSave garantit qu'aucune saisie n'est perdue.
  const ingredientsStatus = useDebouncedSave(
    ingredients,
    (v) =>
      patchMeal({
        ingredients: v
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name.trim(),
            quantity: Number(i.quantity),
            unit: i.unit,
            note: i.note?.trim() || null,
          })),
      }),
    LIST_SAVE_DEBOUNCE_MS
  );
  const utensilsStatus = useDebouncedSave(
    utensils,
    (v) => patchMeal({ utensils: v.map((n) => ({ name: n })) }),
    LIST_SAVE_DEBOUNCE_MS
  );
  // Bloc-notes recette : saisie longue et continue, meme debounce que les listes pour
  // ne pas emettre un PATCH par phrase tapee. Vide = null (pas de recette).
  const recipeStatus = useDebouncedSave(
    recipe,
    (v) => patchMeal({ recipe: v.trim() || null }),
    LIST_SAVE_DEBOUNCE_MS
  );

  const isFull = meal.assistants.length >= meal.maxAssistants;

  return (
    <div className="card bg-base-200 shadow-none">
      <div className="card-body p-3 space-y-3">
        {/* Le creneau (jour + moment + horaire) est l'info la plus importante de la
            fiche : titre de la carte, plus visible que le nom du repas en dessous. */}
        <div className="flex flex-wrap items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden="true">
            {SERVICE_ICONS[meal.service]}
          </span>
          <div className="flex-1 min-w-[180px]">
            <p className="text-lg font-bold capitalize leading-tight">
              {dayLabel(meal.startDateTime)} · {serviceLabel(meal.service)}
            </p>
            <p className="text-sm opacity-60">
              {formatParisTime(meal.startDateTime)} → {formatParisTime(meal.endDateTime)}
            </p>
          </div>
          <span className={`badge badge-sm ${isFull ? "badge-success" : "badge-warning"}`}>
            {meal.assistants.length}/{meal.maxAssistants} équipier(s)
          </span>
        </div>

        {/* Qui est deja sur le coup : noms visibles, pas juste un compteur. */}
        <div className="flex flex-wrap gap-1.5">
          {meal.assistants.map((a) => (
            <span key={a.id} className="badge badge-outline">
              {displayedName(a)}
            </span>
          ))}
          {meal.remainingSeats > 0 && (
            <span className="badge badge-ghost opacity-60">
              {meal.remainingSeats} place{meal.remainingSeats > 1 ? "s" : ""} libre
              {meal.remainingSeats > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {meal.vegeCount !== undefined && meal.carneCount !== undefined && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
              Répartition des convives
            </span>
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg bg-base-300/50 px-3 py-1.5">
                <span aria-hidden="true">🌱</span>
                <span className="font-serif text-lg font-semibold tabular-nums">
                  {meal.vegeCount}
                </span>
                <span className="text-xs opacity-60">végé</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-base-300/50 px-3 py-1.5">
                <span aria-hidden="true">🥩</span>
                <span className="font-serif text-lg font-semibold tabular-nums">
                  {meal.carneCount}
                </span>
                <span className="text-xs opacity-60">carné</span>
              </div>
            </div>
            {eventParticipantsCount !== undefined &&
              meal.vegeCount + meal.carneCount !== eventParticipantsCount && (
                <p className="text-xs opacity-70">
                  Ce total ne correspond plus aux {eventParticipantsCount} participants actuels de
                  l'événement — le responsable cuisine doit mettre à jour cette répartition, tu n'as
                  rien à faire.
                </p>
              )}
          </div>
        )}

        <div className="form-control max-w-md">
          <label className="label py-1" htmlFor={`mfe-name-${meal.id}`}>
            <span className="label-text">Nom du repas</span>
            <FieldStatus status={nameStatus} />
          </label>
          <input
            id={`mfe-name-${meal.id}`}
            type="text"
            className="input input-bordered input-sm w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Deux colonnes des lg : listes a gauche, bloc-notes recette a droite (il se
            lit en meme temps qu'on saisit les ingredients). En dessous, une seule
            colonne, la recette passant sous les ustensiles. */}
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          <div className="space-y-3">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">Ingrédients</span>
                <FieldStatus status={ingredientsStatus} />
              </label>
              <IngredientListInput value={ingredients} onChange={setIngredients} />
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">Ustensiles spécifiques</span>
                <FieldStatus status={utensilsStatus} />
              </label>
              <UtensilListInput value={utensils} onChange={setUtensils} />
            </div>
          </div>

          <div className="form-control">
            <label className="label py-1" htmlFor={`mfe-recipe-${meal.id}`}>
              <span className="label-text">Recette et instructions</span>
              <FieldStatus status={recipeStatus} />
            </label>
            <textarea
              id={`mfe-recipe-${meal.id}`}
              className="textarea textarea-bordered w-full min-h-[12rem] lg:min-h-[20rem] leading-relaxed"
              maxLength={RECIPE_MAX_LENGTH}
              placeholder="Colle ta recette, le déroulé de la préparation, des remarques pour ton équipe..."
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
            />
            <span className="label-text-alt opacity-60 pt-1">
              Visible par ton équipe et le responsable cuisine.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
