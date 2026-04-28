import BoardGameCard from "./BoardGameCard";
import EmptyState from "../common/EmptyState";

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
  linkedTables?: { id: string; title: string }[];
}

interface Props {
  entries: EventBoardGameEntry[];
  onRemove?: (entryId: string) => void;
  onClickGame?: (gameId: string) => void;
  currentUserId?: string;
  isAdmin?: boolean;
  emptyDescription?: string;
}

interface GroupedGame {
  game: EventBoardGameEntry["boardGame"];
  broughtBy: { id: string; username: string }[];
  removableEntries: { entryId: string; broughtByUserId: string }[];
  linkedTables: { id: string; title: string }[];
}

export default function BoardGameList({
  entries,
  onRemove,
  onClickGame,
  currentUserId,
  isAdmin,
  emptyDescription,
}: Props) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<span>🎲</span>}
        title="No board games added yet"
        description={
          emptyDescription ?? "Add a board game to share with the group."
        }
      />
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
        linkedTables: entry.linkedTables ?? [],
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
    <div className="grid gap-2 animate-fade-in">
      {Object.values(grouped).map((group) => (
        <BoardGameCard
          key={group.game.id}
          game={group.game}
          broughtBy={group.broughtBy}
          linkedTables={group.linkedTables}
          onRemove={onRemove}
          removableEntries={group.removableEntries}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClick={onClickGame ? () => onClickGame(group.game.id) : undefined}
        />
      ))}
    </div>
  );
}
