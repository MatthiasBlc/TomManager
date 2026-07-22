import { useState, useRef, useEffect } from "react";
import api from "../../config/api";
import { UNIT_OPTIONS, type Unit } from "./units";

export interface IngredientRow {
  name: string;
  quantity: number;
  unit: Unit;
}

interface Product {
  id: string;
  name: string;
}

interface Props {
  value: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
}

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

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/kitchen/products?q=${encodeURIComponent(value.trim())}`);
        setSuggestions(res.data.data);
      } catch {
        setSuggestions([]);
      }
    }, 200);
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
  };

  const addRow = () => {
    onChange([...value, { name: "", quantity: 1, unit: "G" }]);
    setQuantityDrafts({});
  };

  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => removeRow(i)}
            aria-label="Retirer l'ingrédient"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={addRow}>
        + Ajouter un ingrédient
      </button>
    </div>
  );
}
