import BoardGameCard from "./BoardGameCard";

interface EventBoardGameEntry {
  id: string;
  boardGame: {
    id: string;
    name: string;
    yearPublished?: number | null;
    minPlayers?: number | null;
    maxPlayers?: number | null;
    playingTime?: number | null;
    imageUrl?: string | null;
  };
  broughtBy: { id: string; username: string };
}

interface Props {
  entries: EventBoardGameEntry[];
  onRemove: (entryId: string) => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

interface GroupedGame {
  game: EventBoardGameEntry["boardGame"];
  broughtBy: { id: string; username: string }[];
  removableEntries: { entryId: string; broughtByUserId: string }[];
}

export default function BoardGameList({ entries, onRemove, currentUserId, isAdmin }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 opacity-50">
        No board games added yet.
      </div>
    );
  }

  // Group by boardGameId
  const grouped = entries.reduce<Record<string, GroupedGame>>((acc, entry) => {
    const key = entry.boardGame.id;
    if (!acc[key]) {
      acc[key] = {
        game: entry.boardGame,
        broughtBy: [],
        removableEntries: [],
      };
    }
    acc[key].broughtBy.push(entry.broughtBy);
    acc[key].removableEntries.push({
      entryId: entry.id,
      broughtByUserId: entry.broughtBy.id,
    });
    return acc;
  }, {});

  return (
    <div className="grid gap-2">
      {Object.values(grouped).map((group) => (
        <BoardGameCard
          key={group.game.id}
          game={group.game}
          broughtBy={group.broughtBy}
          onRemove={onRemove}
          removableEntries={group.removableEntries}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
