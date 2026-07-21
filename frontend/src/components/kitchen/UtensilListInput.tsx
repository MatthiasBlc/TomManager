import { useState } from "react";

interface Props {
  value: string[];
  onChange: (utensils: string[]) => void;
}

export default function UtensilListInput({ value, onChange }: Props) {
  const [input, setInput] = useState("");

  const addUtensil = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const removeUtensil = (name: string) => {
    onChange(value.filter((u) => u !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addUtensil(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      removeUtensil(value[value.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border rounded-lg bg-base-100 min-h-[2.5rem]">
      {value.map((utensil) => (
        <span key={utensil} className="badge badge-outline gap-1">
          {utensil}
          <button
            type="button"
            onClick={() => removeUtensil(utensil)}
            className="text-xs"
            aria-label={`Retirer l'ustensile ${utensil}`}
          >
            x
          </button>
        </span>
      ))}
      <input
        type="text"
        className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
        placeholder={value.length === 0 ? "Ajouter des ustensiles..." : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addUtensil(input);
        }}
      />
    </div>
  );
}
