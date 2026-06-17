import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import BoardGameSearchInput from "./BoardGameSearchInput";
import ManualBoardGameForm from "./ManualBoardGameForm";
import ResponsiveModal from "../common/ResponsiveModal";

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

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  eventId: string;
}

export default function AddBoardGameModal({ open, onClose, onAdded, eventId }: Props) {
  const [mode, setMode] = useState<"search" | "manual">("search");

  const handleClose = () => {
    setMode("search");
    onClose();
  };

  const addToEvent = async (boardGameId: string) => {
    try {
      await api.post(`/api/events/${eventId}/boardgames`, { boardGameId });
      toast.success("Jeu ajoute !");
      onAdded();
      handleClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec de l'ajout du jeu";
      toast.error(message);
    }
  };

  const handleSelect = async (game: BoardGameResult) => {
    if (game.id) {
      await addToEvent(game.id);
    } else if (game.externalSource === "BGG" && game.externalId) {
      try {
        const res = await api.post("/api/boardgames/from-bgg", {
          bggId: game.externalId,
          name: game.name,
          yearPublished: game.yearPublished ?? undefined,
          minPlayers: game.minPlayers ?? undefined,
          maxPlayers: game.maxPlayers ?? undefined,
          playingTime: game.playingTime ?? undefined,
          description: game.description ?? undefined,
          imageUrl: game.imageUrl ?? undefined,
        });
        await addToEvent(res.data.data.id);
      } catch {
        toast.error("Echec de l'import depuis BGG");
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
      toast.error("Echec de la creation du jeu");
    }
  };

  return (
    <ResponsiveModal open={open} onClose={handleClose} title="Ajouter un jeu">
      <div className="p-4 md:p-0 md:mt-4">
        {mode === "search" ? (
          <>
            <BoardGameSearchInput onSelect={handleSelect} />
            <div className="divider text-sm opacity-50">ou</div>
            <button className="btn btn-outline btn-sm w-full" onClick={() => setMode("manual")}>
              Creer manuellement
            </button>
          </>
        ) : (
          <ManualBoardGameForm onSubmit={handleManualCreate} onCancel={() => setMode("search")} />
        )}

        <div className="flex justify-end pt-4">
          <button className="btn" onClick={handleClose}>
            Fermer
          </button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
