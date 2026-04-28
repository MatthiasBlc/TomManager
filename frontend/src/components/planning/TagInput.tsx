import { useState, useRef, useEffect } from "react";
import api from "../../config/api";

interface Tag {
  id: string;
  name: string;
}

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ value, onChange }: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(
          `/api/tags?q=${encodeURIComponent(input.trim())}`,
        );
        setSuggestions(
          res.data.data.filter((t: Tag) => !value.includes(t.name)),
        );
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, value]);

  const addTag = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (name: string) => {
    onChange(value.filter((t) => t !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-2 border rounded-lg bg-base-100 min-h-[2.5rem]">
        {value.map((tag) => (
          <span key={tag} className="badge badge-primary gap-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-xs"
              aria-label={`Remove tag ${tag}`}
            >
              x
            </button>
          </span>
        ))}
        <input
          type="text"
          className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
          placeholder={value.length === 0 ? "Add tags..." : ""}
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
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-base-100 border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
              onMouseDown={() => addTag(s.name)}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
