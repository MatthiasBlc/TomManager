import { useState } from "react";

interface Props {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  "aria-label"?: string;
}

export default function NumberStepper({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled,
  "aria-label": ariaLabel,
}: Props) {
  const safeValue = Number.isFinite(value) ? value : min;
  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n);
  const canDecrement = !disabled && safeValue > min;
  const canIncrement = !disabled && (max === undefined || safeValue < max);

  // Saisie clavier (pave numerique) : on garde le texte brut le temps de la frappe pour
  // tolerer les etats intermediaires (champ vide, valeur hors bornes), tout en ne
  // remontant que des valeurs entieres clampees au parent. Le brouillon est abandonne au
  // blur, ce qui resynchronise l'affichage sur la valeur reellement retenue.
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(safeValue);

  const handleTyping = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    setDraft(digits);
    if (digits === "") return;
    const next = clamp(Number.parseInt(digits, 10));
    if (next !== safeValue) onChange(next);
  };

  const commit = () => {
    // Un champ vide (ou hors bornes) laisse simplement la derniere valeur retenue.
    setDraft(null);
  };

  return (
    <div className="join">
      <button
        type="button"
        className="btn btn-sm join-item"
        disabled={!canDecrement}
        onClick={() => {
          setDraft(null);
          onChange(Math.max(min, safeValue - step));
        }}
        aria-label="Diminuer"
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={ariaLabel}
        disabled={disabled}
        className="input input-bordered input-sm join-item w-14 text-center"
        value={displayed}
        onChange={(e) => handleTyping(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        className="btn btn-sm join-item"
        disabled={!canIncrement}
        onClick={() => {
          setDraft(null);
          onChange(clamp(safeValue + step));
        }}
        aria-label="Augmenter"
      >
        +
      </button>
    </div>
  );
}
