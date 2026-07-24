import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminRights } from "../../hooks/useAdminRights";
import BoardGameList from "./BoardGameList";
import BoardGameDetailModal from "./BoardGameDetailModal";
import AddBoardGameModal from "./AddBoardGameModal";
import PoweredByBGG from "./PoweredByBGG";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonBoardGameList } from "../common/Skeleton";

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
    description?: string | null;
  };
  broughtBy: { id: string; username: string };
  linkedTables: { id: string; title: string }[];
}

interface Props {
  eventId: string;
}

type TabMode = "all" | "mine";
type SortMode = "name" | "tables";
type FilterMode = "all" | "withTable" | "withoutTable";

interface GroupedGame {
  game: EventBoardGameEntry["boardGame"];
  broughtBy: { id: string; username: string }[];
  linkedTables: { id: string; title: string }[];
}

function groupEntries(entries: EventBoardGameEntry[]): GroupedGame[] {
  const map: Record<string, GroupedGame> = {};
  for (const e of entries) {
    const key = e.boardGame.id;
    if (!map[key]) {
      map[key] = { game: e.boardGame, broughtBy: [], linkedTables: e.linkedTables ?? [] };
    }
    map[key].broughtBy.push(e.broughtBy);
  }
  return Object.values(map);
}

export default function BoardGameTab({ eventId }: Props) {
  const { user } = useAuth();
  const { canModerateGames } = useAdminRights();
  const [entries, setEntries] = useState<EventBoardGameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<TabMode>("all");
  const [sort, setSort] = useState<SortMode>("name");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedGame, setSelectedGame] = useState<GroupedGame | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/boardgames`);
      setEntries(res.data.data);
    } catch {
      toast.error("Échec du chargement des jeux");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEventSocket(eventId, {
    onBoardGameAdded: fetchEntries,
    onBoardGameRemoved: fetchEntries,
  });

  const handleRemove = async (entryId: string) => {
    try {
      await api.delete(`/api/events/${eventId}/boardgames/${entryId}`);
      toast.success("Jeu retiré");
      fetchEntries();
    } catch {
      toast.error("Échec du retrait du jeu");
    }
  };

  const handleClickGame = (gameId: string) => {
    const groups = groupEntries(entries);
    const group = groups.find((g) => g.game.id === gameId);
    if (group) setSelectedGame(group);
  };

  // Apply tab → mine filter on raw entries
  const tabFiltered = tab === "mine" ? entries.filter((e) => e.broughtBy.id === user?.id) : entries;

  // Group then apply sort/filter on groups
  const groups = groupEntries(tabFiltered);

  const filteredGroups = groups.filter((g) => {
    if (filter === "withTable") return g.linkedTables.length > 0;
    if (filter === "withoutTable") return g.linkedTables.length === 0;
    return true;
  });

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (sort === "tables") {
      const diff = b.linkedTables.length - a.linkedTables.length;
      if (diff !== 0) return diff;
    }
    return a.game.name.localeCompare(b.game.name);
  });

  // Build sort rank and allowed game id set from sorted groups
  const rankByGameId: Record<string, number> = {};
  sortedGroups.forEach((g, i) => {
    rankByGameId[g.game.id] = i;
  });
  const visibleGameIds = new Set(sortedGroups.map((g) => g.game.id));

  // Filter and sort original per-user entries to match group order
  const visibleEntries = tabFiltered
    .filter((e) => visibleGameIds.has(e.boardGame.id))
    .sort((a, b) => (rankByGameId[a.boardGame.id] ?? 0) - (rankByGameId[b.boardGame.id] ?? 0));

  const segBtn = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
      active ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content"
    }`;

  return (
    <div>
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <div className="flex gap-1 bg-base-200 border border-base-300 rounded-lg p-1">
          <button className={segBtn(tab === "all")} onClick={() => setTab("all")}>
            Tous les jeux {!loading && `(${entries.length})`}
          </button>
          <button className={segBtn(tab === "mine")} onClick={() => setTab("mine")}>
            Mes jeux {!loading && `(${entries.filter((e) => e.broughtBy.id === user?.id).length})`}
          </button>
        </div>
        <button
          className="btn btn-primary btn-sm active:scale-95 transition-transform"
          onClick={() => setShowAdd(true)}
        >
          Ajouter un jeu
        </button>
      </div>

      {/* Sort / filter controls : deux groupes exclusifs distincts (pas de melange
          d'idiomes visuels), chacun un segmented control */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50">Trier</span>
          <div className="flex gap-0.5 bg-base-200 border border-base-300 rounded-md p-0.5">
            <button className={segBtn(sort === "name")} onClick={() => setSort("name")}>
              A-Z
            </button>
            <button className={segBtn(sort === "tables")} onClick={() => setSort("tables")}>
              Tables
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50">
            Filtrer
          </span>
          <div className="flex gap-0.5 bg-base-200 border border-base-300 rounded-md p-0.5">
            <button className={segBtn(filter === "all")} onClick={() => setFilter("all")}>
              Tous
            </button>
            <button
              className={segBtn(filter === "withTable")}
              onClick={() => setFilter("withTable")}
            >
              Avec table
            </button>
            <button
              className={segBtn(filter === "withoutTable")}
              onClick={() => setFilter("withoutTable")}
            >
              Sans table
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonBoardGameList count={3} />
      ) : (
        <BoardGameList
          entries={visibleEntries}
          onRemove={tab === "mine" ? handleRemove : undefined}
          onClickGame={handleClickGame}
          currentUserId={user?.id}
          isAdmin={canModerateGames}
          emptyDescription={tab === "mine" ? "Vous n'avez pas encore ajouté de jeux." : undefined}
        />
      )}

      <div className="flex justify-end mt-4">
        <PoweredByBGG />
      </div>

      <AddBoardGameModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={fetchEntries}
        eventId={eventId}
      />

      <BoardGameDetailModal
        open={selectedGame !== null}
        onClose={() => setSelectedGame(null)}
        game={selectedGame?.game ?? null}
        linkedTables={selectedGame?.linkedTables ?? []}
        broughtBy={selectedGame?.broughtBy ?? []}
      />
    </div>
  );
}
