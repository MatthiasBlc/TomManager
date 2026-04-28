import ResponsiveModal from "../common/ResponsiveModal";

interface BoardGame {
  id: string;
  name: string;
  yearPublished?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playingTime?: number | null;
  imageUrl?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  game: BoardGame | null;
  linkedTables: { id: string; title: string }[];
  broughtBy: { id: string; username: string }[];
}

export default function BoardGameDetailModal({
  open,
  onClose,
  game,
  linkedTables,
  broughtBy,
}: Props) {
  if (!game) return null;

  return (
    <ResponsiveModal open={open} onClose={onClose} title={game.name}>
      <div className="space-y-4 p-4 md:p-0 md:mt-4">
        {game.imageUrl && (
          <img
            src={game.imageUrl}
            alt={game.name}
            className="w-full max-w-xs rounded-lg mx-auto block"
          />
        )}

        <div>
          <h2 className="text-lg font-semibold">
            {game.name}
            {game.yearPublished && (
              <span className="font-normal opacity-50 text-sm ml-1">
                ({game.yearPublished})
              </span>
            )}
          </h2>
          <div className="text-sm opacity-70 mt-1 flex gap-3">
            {game.minPlayers != null && game.maxPlayers != null && (
              <span>
                {game.minPlayers}-{game.maxPlayers} joueurs
              </span>
            )}
            {game.playingTime != null && <span>{game.playingTime} min</span>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold opacity-70 mb-1">
            Apporte par
          </h3>
          <div className="flex flex-wrap gap-1">
            {broughtBy.map((u) => (
              <span key={u.id} className="badge badge-outline badge-sm">
                {u.username}
              </span>
            ))}
          </div>
        </div>

        {linkedTables.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold opacity-70 mb-1">
              Tables associees ({linkedTables.length})
            </h3>
            <div className="space-y-1">
              {linkedTables.map((t) => (
                <div key={t.id} className="text-sm p-2 bg-base-200 rounded">
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {linkedTables.length === 0 && (
          <p className="text-sm opacity-50">Aucune table associee</p>
        )}
      </div>
    </ResponsiveModal>
  );
}
