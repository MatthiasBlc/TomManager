import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import BoardGameSearchInput from "../boardgames/BoardGameSearchInput";
import ManualBoardGameForm from "../boardgames/ManualBoardGameForm";

export interface SelectedGame {
  id: string;
  name: string;
  maxPlayers?: number | null;
  playingTime?: number | null;
}

interface Props {
  value: SelectedGame | null;
  onChange: (game: SelectedGame | null) => void;
}

type Mode = "search" | "manual";

export default function BoardGameSelector({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [resolving, setResolving] = useState(false);

  const handleSearchSelect = async (game: {
    id: string | null;
    name: string;
    externalSource?: string | null;
    externalId?: string | null;
    yearPublished?: number | null;
    maxPlayers?: number | null;
    playingTime?: number | null;
  }) => {
    if (game.id) {
      onChange({ id: game.id, name: game.name, maxPlayers: game.maxPlayers, playingTime: game.playingTime });
      return;
    }
    if (game.externalSource === "BGG" && game.externalId) {
      setResolving(true);
      try {
        const res = await api.post("/api/boardgames/from-bgg", {
          bggId: game.externalId,
          name: game.name,
          yearPublished: game.yearPublished,
        });
        const created = res.data.data;
        onChange({ id: created.id, name: created.name, maxPlayers: created.maxPlayers, playingTime: created.playingTime });
      } catch {
        toast.error("Impossible d'ajouter ce jeu BGG");
      } finally {
        setResolving(false);
      }
    }
  };

  const handleManualSubmit = async (data: {
    name: string;
    yearPublished?: number;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
  }) => {
    setResolving(true);
    try {
      const res = await api.post("/api/boardgames", data);
      const created = res.data.data;
      onChange({ id: created.id, name: created.name, maxPlayers: created.maxPlayers, playingTime: created.playingTime });
      setMode("search");
    } catch {
      toast.error("Impossible de creer le jeu");
    } finally {
      setResolving(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
        <span className="badge badge-primary badge-sm">JDS</span>
        <span className="text-sm flex-1 font-medium">{value.name}</span>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => onChange(null)}
        >
          ✕
        </button>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <ManualBoardGameForm
        onSubmit={handleManualSubmit}
        onCancel={() => setMode("search")}
      />
    );
  }

  return (
    <div className="space-y-2">
      {resolving ? (
        <div className="flex items-center gap-2 text-sm opacity-60">
          <span className="loading loading-spinner loading-xs" />
          Ajout du jeu...
        </div>
      ) : (
        <BoardGameSearchInput onSelect={handleSearchSelect} />
      )}
      <button
        type="button"
        className="btn btn-ghost btn-xs text-base-content/60"
        onClick={() => setMode("manual")}
      >
        + Creer manuellement
      </button>
    </div>
  );
}
