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

export default function IngredientListInput({ value, onChange }: Props) {
  // Saisie brute par ligne (point 8, virgule ET point acceptes) : affiche le texte
  // tape tel quel tant qu'il ne parse pas encore en nombre valide (ex. "1," en
  // cours de frappe avant le "5"), pour ne jamais "avaler" le separateur decimal.
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  // Lignes dont le champ commentaire est deplie alors qu'il est encore vide : une
  // ligne avec commentaire l'affiche toujours, sans avoir a le rouvrir.
  const [openNotes, setOpenNotes] = useState<Record<number, boolean>>({});

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
    onChange(value.filter((_, i) => i !== index));
    setQuantityDrafts({});
    setOpenNotes({});
  };

  const addRow = () => {
    onChange([...value, { name: "", quantity: 1, unit: "G" }]);
    setQuantityDrafts({});
  };

  return (
    <div className="space-y-2">
      {value.map((row, i) => {
        const note = row.note ?? "";
        const showNote = note.length > 0 || openNotes[i];
        return (
          <div key={i} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
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
                  aria-label={`Ajouter un commentaire sur ${row.name || "cet ingrédient"}`}
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
                  aria-label={`Commentaire sur ${row.name || "cet ingrédient"}`}
                  value={note}
                  onChange={(e) => updateRow(i, { note: e.target.value })}
                />
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
