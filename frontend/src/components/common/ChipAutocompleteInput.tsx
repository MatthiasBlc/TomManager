import { useState, useRef, useEffect } from "react";
import api from "../../config/api";

interface Suggestion {
  id: string;
  name: string;
}

interface Props {
  value: string[];
  onChange: (values: string[]) => void;
  searchEndpoint: string;
  placeholder: string;
  removeLabel: (item: string) => string;
  createHintLabel: (input: string) => string;
  searchErrorLabel: string;
  badgeClassName?: string;
}

// Chips + autocomplete generique (extrait de TagInput, reutilise par UtensilListInput,
// Evolutions.md point 7 : meme UX dedup/reutilisation qu'un catalogue Tag pour tout
// consommateur qui a besoin d'une liste de chaines avec suggestions serveur).
export default function ChipAutocompleteInput({
  value,
  onChange,
  searchEndpoint,
  placeholder,
  removeLabel,
  createHintLabel,
  searchErrorLabel,
  badgeClassName = "badge-primary",
}: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    setShowSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`${searchEndpoint}?q=${encodeURIComponent(input.trim())}`);
        setSuggestions(res.data.data.filter((s: Suggestion) => !value.includes(s.name)));
        setSearchFailed(false);
      } catch {
        setSuggestions([]);
        setSearchFailed(true);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, value, searchEndpoint]);

  const addItem = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeItem = (name: string) => {
    onChange(value.filter((v) => v !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addItem(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      removeItem(value[value.length - 1]);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-2 border rounded-lg bg-base-100 min-h-[2.5rem]">
        {value.map((item) => (
          <span key={item} className={`badge ${badgeClassName} gap-1`}>
            {item}
            <button
              type="button"
              onClick={() => removeItem(item)}
              className="text-xs"
              aria-label={removeLabel(item)}
            >
              x
            </button>
          </span>
        ))}
        <input
          type="text"
          className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
          placeholder={value.length === 0 ? placeholder : ""}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
        />
      </div>
      {showSuggestions && input.trim() && (
        <ul className="absolute z-10 w-full bg-base-100 border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
          {searching ? (
            <li className="px-3 py-2 text-sm opacity-60 flex items-center gap-2">
              <span className="loading loading-spinner loading-xs" />
              Recherche...
            </li>
          ) : searchFailed ? (
            <li className="px-3 py-2 text-sm text-error">{searchErrorLabel}</li>
          ) : suggestions.length > 0 ? (
            suggestions.map((s) => (
              <li
                key={s.id}
                className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
                onMouseDown={() => addItem(s.name)}
              >
                {s.name}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm opacity-60">{createHintLabel(input.trim())}</li>
          )}
        </ul>
      )}
    </div>
  );
}
