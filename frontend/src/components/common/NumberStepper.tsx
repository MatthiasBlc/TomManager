interface Props {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export default function NumberStepper({ id, value, onChange, min = 0, max, disabled }: Props) {
  const safeValue = Number.isFinite(value) ? value : min;
  const canDecrement = !disabled && safeValue > min;
  const canIncrement = !disabled && (max === undefined || safeValue < max);

  return (
    <div className="join">
      <button
        type="button"
        className="btn btn-sm join-item"
        disabled={!canDecrement}
        onClick={() => onChange(Math.max(min, safeValue - 1))}
        aria-label="Diminuer"
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        readOnly
        className="input input-bordered input-sm join-item w-14 text-center"
        value={safeValue}
      />
      <button
        type="button"
        className="btn btn-sm join-item"
        disabled={!canIncrement}
        onClick={() => onChange(max !== undefined ? Math.min(max, safeValue + 1) : safeValue + 1)}
        aria-label="Augmenter"
      >
        +
      </button>
    </div>
  );
}
