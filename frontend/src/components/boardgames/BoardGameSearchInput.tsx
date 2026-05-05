import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../../config/api";
import PoweredByBGG from "./PoweredByBGG";

interface BoardGameResult {
  id: string | null;
  name: string;
  externalSource?: string | null;
  externalId?: string | null;
  yearPublished?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playingTime?: number | null;
  description?: string | null;
  imageUrl?: string | null;
}

interface BGGPreview {
  bggId: string;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  description?: string;
  imageUrl?: string;
}

interface Props {
  onSelect: (game: BoardGameResult) => void;
}

export default function BoardGameSearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BoardGameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [preview, setPreview] = useState<{
    game: BoardGameResult;
    detail: BGGPreview | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/boardgames/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data.data);
        setOpen(true);
        setPreview(null);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if ((open || preview) && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [open, preview]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideInput = inputRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      const insidePreview = previewRef.current?.contains(target);
      if (!insideInput && !insideDropdown && !insidePreview) {
        setOpen(false);
        setPreview(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleClickResult = async (game: BoardGameResult) => {
    setOpen(false);

    // Jeu deja en DB : toutes les infos sont disponibles directement
    if (game.id) {
      setPreview({ game, detail: null });
      return;
    }

    // Jeu BGG : fetch le detail complet
    if (game.externalSource === "BGG" && game.externalId) {
      setPreviewLoading(true);
      setPreview({ game, detail: null });
      try {
        const res = await api.get(`/api/boardgames/bgg-preview/${game.externalId}`);
        setPreview({ game, detail: res.data.data });
      } catch {
        setPreview({ game, detail: null });
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    const { game, detail } = preview;
    onSelect({
      ...game,
      minPlayers: detail?.minPlayers ?? game.minPlayers ?? null,
      maxPlayers: detail?.maxPlayers ?? game.maxPlayers ?? null,
      playingTime: detail?.playingTime ?? game.playingTime ?? null,
      description: detail?.description ?? game.description ?? null,
      imageUrl: detail?.imageUrl ?? game.imageUrl ?? null,
      yearPublished: detail?.yearPublished ?? game.yearPublished ?? null,
      name: detail?.name ?? game.name,
    });
    setQuery("");
    setResults([]);
    setPreview(null);
  };

  const handleBackToResults = () => {
    setPreview(null);
    setOpen(true);
  };

  // Infos a afficher dans l'apercu
  const previewData = preview
    ? {
        name: preview.detail?.name ?? preview.game.name,
        yearPublished: preview.detail?.yearPublished ?? preview.game.yearPublished,
        minPlayers: preview.detail?.minPlayers ?? preview.game.minPlayers,
        maxPlayers: preview.detail?.maxPlayers ?? preview.game.maxPlayers,
        playingTime: preview.detail?.playingTime ?? preview.game.playingTime,
        description: preview.detail?.description ?? preview.game.description,
        imageUrl: preview.detail?.imageUrl ?? preview.game.imageUrl,
        isBGG: !preview.game.id && preview.game.externalSource === "BGG",
      }
    : null;

  const dropdown =
    open && results.length > 0
      ? createPortal(
          <ul
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-base-200 rounded-box shadow-lg max-h-72 overflow-y-auto overflow-x-hidden"
          >
            {results.map((game, idx) => (
              <li key={game.id || `bgg-${game.externalId}-${idx}`} className="w-full">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-base-300"
                  onClick={() => handleClickResult(game)}
                >
                  <span className="flex-1 truncate">{game.name}</span>
                  {game.yearPublished && (
                    <span className="opacity-50 text-sm shrink-0">({game.yearPublished})</span>
                  )}
                  {!game.id && game.externalSource === "BGG" && (
                    <span className="badge badge-xs badge-info shrink-0">BGG</span>
                  )}
                </button>
              </li>
            ))}
            {results.some((g) => !g.id && g.externalSource === "BGG") && (
              <li className="flex justify-end px-3 py-2 border-t border-base-300">
                <PoweredByBGG />
              </li>
            )}
          </ul>,
          document.body
        )
      : null;

  const previewPanel =
    preview && previewData
      ? createPortal(
          <div
            ref={previewRef}
            style={dropdownStyle}
            className="bg-base-200 rounded-box shadow-lg overflow-hidden"
          >
            {previewLoading ? (
              <div className="flex items-center justify-center p-6">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : (
              <>
                <div className="flex gap-3 p-3">
                  {previewData.imageUrl && (
                    <img
                      src={previewData.imageUrl}
                      alt={previewData.name}
                      className="w-20 h-20 object-cover rounded shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {previewData.name}
                      {previewData.yearPublished && (
                        <span className="opacity-50 font-normal text-sm ml-1">
                          ({previewData.yearPublished})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm mt-1 opacity-70">
                      {(previewData.minPlayers || previewData.maxPlayers) && (
                        <span>
                          {previewData.minPlayers === previewData.maxPlayers
                            ? `${previewData.minPlayers} joueurs`
                            : `${previewData.minPlayers ?? "?"}–${previewData.maxPlayers ?? "?"} joueurs`}
                        </span>
                      )}
                      {previewData.playingTime && <span>{previewData.playingTime} min</span>}
                    </div>
                    {previewData.description && (
                      <p className="text-xs mt-1 opacity-60 line-clamp-3">
                        {previewData.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 px-3 pb-3">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={handleBackToResults}
                  >
                    ← Retour
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary flex-1"
                    onClick={handleConfirm}
                  >
                    Selectionner ce jeu
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="input input-bordered w-full"
        placeholder="Search board games..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && !preview && setOpen(true)}
      />
      {loading && <span className="loading loading-spinner loading-xs absolute right-3 top-3" />}
      {dropdown}
      {previewPanel}
    </div>
  );
}
