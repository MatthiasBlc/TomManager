import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import BoardGameSearchInput from "./BoardGameSearchInput";
import ManualBoardGameForm from "./ManualBoardGameForm";

interface BoardGameResult {
  id: string | null;
  name: string;
  externalSource?: string | null;
  externalId?: string | null;
  yearPublished?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  eventId: string;
}

export default function AddBoardGameModal({ open, onClose, onAdded, eventId }: Props) {
  const [mode, setMode] = useState<"search" | "manual">("search");

  const addToEvent = async (boardGameId: string) => {
    try {
      await api.post(`/api/events/${eventId}/boardgames`, { boardGameId });
      toast.success("Board game added!");
      onAdded();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to add board game";
      toast.error(message);
    }
  };

  const handleSelect = async (game: BoardGameResult) => {
    if (game.id) {
      // Local game — add directly
      await addToEvent(game.id);
    } else if (game.externalSource === "BGG" && game.externalId) {
      // BGG result — find or create, then add
      try {
        const res = await api.post("/api/boardgames/from-bgg", {
          bggId: game.externalId,
          name: game.name,
          yearPublished: game.yearPublished,
        });
        await addToEvent(res.data.data.id);
      } catch {
        toast.error("Failed to import from BGG");
      }
    }
  };

  const handleManualCreate = async (data: {
    name: string;
    yearPublished?: number;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
  }) => {
    try {
      const res = await api.post("/api/boardgames", data);
      await addToEvent(res.data.data.id);
      setMode("search");
    } catch {
      toast.error("Failed to create board game");
    }
  };

  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Add Board Game</h3>

        {mode === "search" ? (
          <>
            <BoardGameSearchInput onSelect={handleSelect} />
            <div className="divider text-sm opacity-50">or</div>
            <button
              className="btn btn-outline btn-sm w-full"
              onClick={() => setMode("manual")}
            >
              Create manually
            </button>
          </>
        ) : (
          <ManualBoardGameForm
            onSubmit={handleManualCreate}
            onCancel={() => setMode("search")}
          />
        )}

        <div className="modal-action">
          <button
            className="btn"
            onClick={() => {
              setMode("search");
              onClose();
            }}
          >
            Close
          </button>
        </div>
      </div>
      <div
        className="modal-backdrop"
        onClick={() => {
          setMode("search");
          onClose();
        }}
      />
    </dialog>
  );
}
