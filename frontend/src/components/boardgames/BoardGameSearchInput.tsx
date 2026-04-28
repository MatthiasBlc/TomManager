import { useState, useEffect, useRef } from "react";
import api from "../../config/api";

interface BoardGameResult {
  id: string | null;
  name: string;
  externalSource?: string | null;
  externalId?: string | null;
  yearPublished?: number | null;
}

interface Props {
  onSelect: (game: BoardGameResult) => void;
}

export default function BoardGameSearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BoardGameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(
          `/api/boardgames/search?q=${encodeURIComponent(query.trim())}`,
        );
        setResults(res.data.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (game: BoardGameResult) => {
    onSelect(game);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="input input-bordered w-full"
        placeholder="Search board games..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && (
        <span className="loading loading-spinner loading-xs absolute right-3 top-3" />
      )}
      {open && results.length > 0 && (
        <ul className="menu bg-base-200 rounded-box shadow-lg absolute z-50 w-full max-h-48 overflow-y-auto mt-1 md:max-h-60">
          {results.map((game, idx) => (
            <li key={game.id || `bgg-${game.externalId}-${idx}`}>
              <button type="button" onClick={() => handleSelect(game)}>
                <span>{game.name}</span>
                {game.yearPublished && (
                  <span className="opacity-50 text-sm">
                    ({game.yearPublished})
                  </span>
                )}
                {!game.id && game.externalSource === "BGG" && (
                  <span className="badge badge-xs badge-info">BGG</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
