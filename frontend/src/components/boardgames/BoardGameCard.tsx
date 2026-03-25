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
  game: BoardGame;
  broughtBy: { id: string; username: string }[];
  onRemove?: (entryId: string) => void;
  removableEntries?: { entryId: string; broughtByUserId: string }[];
  currentUserId?: string;
  isAdmin?: boolean;
}

export default function BoardGameCard({
  game,
  broughtBy,
  onRemove,
  removableEntries,
  currentUserId,
  isAdmin,
}: Props) {
  return (
    <div className="card bg-base-100 shadow-sm border">
      <div className="card-body p-4">
        <div className="flex gap-3">
          {game.imageUrl && (
            <img
              src={game.imageUrl}
              alt={game.name}
              className="w-16 h-16 object-cover rounded"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {game.name}
              {game.yearPublished && (
                <span className="font-normal opacity-50 text-sm ml-1">
                  ({game.yearPublished})
                </span>
              )}
            </h3>
            <div className="text-sm opacity-70 space-x-3">
              {game.minPlayers != null && game.maxPlayers != null && (
                <span>{game.minPlayers}-{game.maxPlayers} players</span>
              )}
              {game.playingTime != null && <span>{game.playingTime} min</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {broughtBy.map((user) => {
                const entry = removableEntries?.find(
                  (e) => e.broughtByUserId === user.id
                );
                const canRemove =
                  onRemove &&
                  entry &&
                  (user.id === currentUserId || isAdmin);

                return (
                  <span key={user.id} className="badge badge-outline badge-sm gap-1">
                    {user.username}
                    {canRemove && (
                      <button
                        type="button"
                        className="text-error hover:text-error-focus"
                        onClick={() => onRemove(entry.entryId)}
                        title="Remove"
                      >
                        x
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
