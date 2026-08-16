import { useState, useRef, useEffect } from "react";
import api from "../../config/api";
import { UNIT_OPTIONS, type Unit } from "./units";

export interface IngredientRow {
  name: string;
  quantity: number;
  unit: Unit;
  // Commentaire libre du chef sur cette ligne, a destination de l'equipe courses
  // (ex. "de preference agrume ou acacia"). Chaine vide = pas de commentaire.
  note?: string;
}

// Longueur max alignee sur la validation backend (ingredientSchema.note).
const NOTE_MAX_LENGTH = 300;

interface Product {
  id: string;
  name: string;
}

interface Props {
  value: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
}

// L'autocompletion partait des le 1er caractere avec 200 ms de debounce : taper
// "concombre" a vitesse normale suffisait a emettre une requete par syllabe (retour
// prod : rafale de 429). En dessous de 2 caracteres la suggestion n'est de toute
// facon pas utile, et 350 ms tient une frappe continue en un seul appel.
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_DEBOUNCE_MS = 350;

function ProductNameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Numero de la derniere recherche lancee : une reponse arrivee dans le desordre
  // (reseau lent puis rapide) ne doit pas ecraser des suggestions plus recentes.
  const querySeqRef = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < SUGGEST_MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const seq = ++querySeqRef.current;
      try {
        const res = await api.get(`/api/kitchen/products?q=${encodeURIComponent(q)}`);
        if (seq === querySeqRef.current) setSuggestions(res.data.data);
      } catch {
        if (seq === querySeqRef.current) setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="relative flex-1 min-w-[140px]">
      <input
        type="text"
        className="input input-bordered input-sm w-full"
        placeholder="Ingrédient"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-base-100 border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
              onMouseDown={() => onChange(s.name)}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Reindexe un etat local indexe par rang de ligne (brouillons de quantite,
// commentaires deplies) apres un deplacement ou une suppression. `order[nouveau] =
// ancien` ; un ancien rang absent de `order` a disparu de la liste.
function remapByIndex<T>(map: Record<number, T>, order: number[]): Record<number, T> {
  const next: Record<number, T> = {};
  order.forEach((oldIndex, newIndex) => {
    if (map[oldIndex] !== undefined) next[newIndex] = map[oldIndex];
  });
  return next;
}

export default function IngredientListInput({ value, onChange }: Props) {
  // Saisie brute par ligne (point 8, virgule ET point acceptes) : affiche le texte
  // tape tel quel tant qu'il ne parse pas encore en nombre valide (ex. "1," en
  // cours de frappe avant le "5"), pour ne jamais "avaler" le separateur decimal.
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  // Lignes dont le champ commentaire est deplie alors qu'il est encore vide : une
  // ligne avec commentaire l'affiche toujours, sans avoir a le rouvrir.
  const [openNotes, setOpenNotes] = useState<Record<number, boolean>>({});
  // Glisser-deposer (pointeur fin uniquement, cf poignee) : ligne saisie et ligne
  // actuellement survolee, pour le retour visuel pendant le deplacement.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // `draggable` n'est arme que sur la ligne dont la poignee est enfoncee : sinon le
  // navigateur capture le glissement DANS les champs texte (plus moyen de selectionner
  // du texte a la souris).
  const [armedIndex, setArmedIndex] = useState<number | null>(null);

  const updateRow = (index: number, patch: Partial<IngredientRow>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleQuantityChange = (index: number, raw: string) => {
    setQuantityDrafts((prev) => ({ ...prev, [index]: raw }));
    const parsed = Number(raw.replace(",", "."));
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
      updateRow(index, { quantity: parsed });
    }
  };

  const clearDraft = (index: number) => {
    setQuantityDrafts((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const removeRow = (index: number) => {
    const order = value.map((_, i) => i).filter((i) => i !== index);
    onChange(value.filter((_, i) => i !== index));
    setQuantityDrafts((prev) => remapByIndex(prev, order));
    setOpenNotes((prev) => remapByIndex(prev, order));
  };

  const addRow = () => {
    onChange([...value, { name: "", quantity: 1, unit: "G" }]);
    setQuantityDrafts({});
  };

  // Deplacement d'une ligne : l'ordre des ingredients est porte jusqu'a la liste de
  // courses (MealIngredient.position), donc un chef peut ranger sa recette dans son
  // ordre de preparation ou par rayon.
  const moveRow = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.length) return;
    const order = value.map((_, i) => i);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    onChange(order.map((oldIndex) => value[oldIndex]));
    setQuantityDrafts((prev) => remapByIndex(prev, order));
    setOpenNotes((prev) => remapByIndex(prev, order));
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
    setArmedIndex(null);
  };

  const removeNote = (index: number) => {
    updateRow(index, { note: "" });
    setOpenNotes((prev) => ({ ...prev, [index]: false }));
  };

  return (
    <div className="space-y-2">
      {value.map((row, i) => {
        const note = row.note ?? "";
        const showNote = note.length > 0 || openNotes[i];
        const label = row.name || "cet ingrédient";
        const isDragged = dragIndex === i;
        const isDropTarget = dragIndex !== null && overIndex === i && dragIndex !== i;
        return (
          <div
            key={i}
            // Le glisser-deposer ne s'arme que depuis la poignee (pointeur fin) ;
            // sur mobile ce sont les fleches qui font foi, elles restent visibles
            // partout et fonctionnent aussi au clavier.
            draggable={armedIndex === i}
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overIndex !== i) setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) moveRow(dragIndex, i);
              endDrag();
            }}
            onDragEnd={endDrag}
            className={`space-y-1 rounded-lg transition-colors ${
              isDragged ? "opacity-50" : ""
            } ${isDropTarget ? "ring-2 ring-primary/60" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Colonne de reorganisation : fleches (tactile + clavier) et, sur
                  ecran avec souris, poignee de glisser-deposer. */}
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className="hidden sm:block cursor-grab select-none px-1 text-base opacity-40 hover:opacity-80 active:cursor-grabbing"
                  aria-hidden="true"
                  title="Glisser pour réorganiser"
                  onPointerDown={() => setArmedIndex(i)}
                  onPointerUp={endDrag}
                >
                  ⠿
                </span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs h-5 min-h-0 px-1 leading-none"
                    disabled={i === 0}
                    onClick={() => moveRow(i, i - 1)}
                    aria-label={`Monter ${label}`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs h-5 min-h-0 px-1 leading-none"
                    disabled={i === value.length - 1}
                    onClick={() => moveRow(i, i + 1)}
                    aria-label={`Descendre ${label}`}
                  >
                    ▼
                  </button>
                </div>
              </div>
              <ProductNameField value={row.name} onChange={(name) => updateRow(i, { name })} />
              <input
                type="text"
                inputMode="decimal"
                className="input input-bordered input-sm w-20"
                value={quantityDrafts[i] ?? String(row.quantity)}
                onChange={(e) => handleQuantityChange(i, e.target.value)}
                onBlur={() => clearDraft(i)}
              />
              <select
                className="select select-bordered select-sm w-24"
                value={row.unit}
                onChange={(e) => updateRow(i, { unit: e.target.value as Unit })}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              {!showNote && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() => setOpenNotes((prev) => ({ ...prev, [i]: true }))}
                  aria-label={`Ajouter un commentaire sur ${label}`}
                  title="Ajouter un commentaire"
                >
                  💬
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => removeRow(i)}
                aria-label="Retirer l'ingrédient"
              >
                ✕
              </button>
            </div>
            {showNote && (
              <div className="flex items-start gap-2 pl-2">
                <span className="text-xs opacity-50 pt-2" aria-hidden="true">
                  💬
                </span>
                <textarea
                  className="textarea textarea-bordered textarea-sm flex-1 min-h-[2.5rem] leading-snug"
                  rows={2}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="Commentaire pour l'équipe courses (ex : de préférence agrume ou acacia)"
                  aria-label={`Commentaire sur ${label}`}
                  value={note}
                  onChange={(e) => updateRow(i, { note: e.target.value })}
                />
                {/* Retirer le commentaire : vide le texte ET replie le champ, sinon
                    une ligne sans commentaire garderait une zone de saisie ouverte. */}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() => removeNote(i)}
                  aria-label={`Retirer le commentaire sur ${label}`}
                  title="Retirer le commentaire"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn-ghost btn-sm" onClick={addRow}>
        + Ajouter un ingrédient
      </button>
    </div>
  );
}
