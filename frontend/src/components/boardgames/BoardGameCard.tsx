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
  const canRemove =
    onRemove &&
    removableEntries?.some(
      (e) => e.broughtByUserId === currentUserId || isAdmin,
    );

  const entryToRemove = canRemove
    ? removableEntries?.find((e) =>
        isAdmin ? true : e.broughtByUserId === currentUserId,
      )
    : undefined;

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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
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
                    <span>
                      {game.minPlayers}-{game.maxPlayers} players
                    </span>
                  )}
                  {game.playingTime != null && (
                    <span>{game.playingTime} min</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {broughtBy.map((user) => (
                    <span
                      key={user.id}
                      className="badge badge-outline badge-sm"
                    >
                      {user.username}
                    </span>
                  ))}
                </div>
              </div>
              {canRemove && entryToRemove && (
                <button
                  type="button"
                  className="btn btn-error btn-xs btn-outline shrink-0"
                  onClick={() => onRemove!(entryToRemove.entryId)}
                  aria-label={`Remove ${game.name}`}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
