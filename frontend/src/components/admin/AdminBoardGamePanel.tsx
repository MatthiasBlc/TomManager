import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";
import EmptyState from "../common/EmptyState";
import { PencilIcon, MergeIcon, TrashIcon, CheckIcon } from "../common/icons";

interface BoardGameAdmin {
  id: string;
  name: string;
  externalSource: string | null;
  externalId: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  imageUrl: string | null;
  _count: { eventBoardGames: number; gameTables: number };
}

interface ListResult {
  games: BoardGameAdmin[];
  total: number;
  page: number;
  limit: number;
}

interface EditForm {
  name: string;
  yearPublished: string;
  minPlayers: string;
  maxPlayers: string;
  playingTime: string;
}

type MergeFieldKey =
  | "name"
  | "yearPublished"
  | "minPlayers"
  | "maxPlayers"
  | "playingTime"
  | "imageUrl"
  | "externalRef";
type FieldPick = "source" | "target";
type MergeFieldPicks = Record<MergeFieldKey, FieldPick>;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function buildDefaultPicks(source: BoardGameAdmin, target: BoardGameAdmin): MergeFieldPicks {
  // Prefer source when target is null and source has a value
  const prefer = (tv: unknown, sv: unknown): FieldPick =>
    tv == null && sv != null ? "source" : "target";
  return {
    name: "target",
    yearPublished: prefer(target.yearPublished, source.yearPublished),
    minPlayers: prefer(target.minPlayers, source.minPlayers),
    maxPlayers: prefer(target.maxPlayers, source.maxPlayers),
    playingTime: prefer(target.playingTime, source.playingTime),
    imageUrl: prefer(target.imageUrl, source.imageUrl),
    externalRef: prefer(target.externalSource, source.externalSource),
  };
}

export default function AdminBoardGamePanel() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<BoardGameAdmin | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<BoardGameAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Merge modal
  const [mergeSource, setMergeSource] = useState<BoardGameAdmin | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const debouncedMergeSearch = useDebounce(mergeSearch, 300);
  const [mergeResults, setMergeResults] = useState<BoardGameAdmin[]>([]);
  const [mergeTarget, setMergeTarget] = useState<BoardGameAdmin | null>(null);
  const [fieldPicks, setFieldPicks] = useState<MergeFieldPicks | null>(null);
  const [merging, setMerging] = useState(false);

  const limit = 20;

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get(`/api/admin/boardgames?${params}`);
      setResult(res.data.data);
    } catch {
      toast.error("Échec du chargement des jeux");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Merge search
  useEffect(() => {
    if (!debouncedMergeSearch || !mergeSource) {
      setMergeResults([]);
      return;
    }
    const params = new URLSearchParams({
      search: debouncedMergeSearch,
      limit: "10",
    });
    api
      .get(`/api/admin/boardgames?${params}`)
      .then((res) =>
        setMergeResults(res.data.data.games.filter((g: BoardGameAdmin) => g.id !== mergeSource.id))
      )
      .catch(() => {});
  }, [debouncedMergeSearch, mergeSource]);

  const totalPages = result ? Math.ceil(result.total / limit) : 0;

  // --- Edit ---
  const {
    register,
    handleSubmit,
    reset: resetEditForm,
    formState: { errors: editErrors, isSubmitting: editSubmitting },
  } = useForm<EditForm>();

  const openEdit = (game: BoardGameAdmin) => {
    setEditTarget(game);
    resetEditForm({
      name: game.name,
      yearPublished: game.yearPublished != null ? String(game.yearPublished) : "",
      minPlayers: game.minPlayers != null ? String(game.minPlayers) : "",
      maxPlayers: game.maxPlayers != null ? String(game.maxPlayers) : "",
      playingTime: game.playingTime != null ? String(game.playingTime) : "",
    });
  };

  const onEditSubmit = async (data: EditForm) => {
    if (!editTarget) return;
    try {
      await api.patch(`/api/admin/boardgames/${editTarget.id}`, {
        name: data.name,
        yearPublished: data.yearPublished ? parseInt(data.yearPublished) : null,
        minPlayers: data.minPlayers ? parseInt(data.minPlayers) : null,
        maxPlayers: data.maxPlayers ? parseInt(data.maxPlayers) : null,
        playingTime: data.playingTime ? parseInt(data.playingTime) : null,
      });
      toast.success("Jeu mis à jour");
      setEditTarget(null);
      fetchGames();
    } catch {
      toast.error("Échec de la mise à jour");
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/boardgames/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" supprimé`);
      setDeleteTarget(null);
      fetchGames();
    } catch {
      toast.error("Échec de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  // --- Merge ---
  const openMerge = (game: BoardGameAdmin) => {
    setMergeSource(game);
    setMergeSearch("");
    setMergeResults([]);
    setMergeTarget(null);
    setFieldPicks(null);
  };

  const selectMergeTarget = (game: BoardGameAdmin) => {
    setMergeTarget(game);
    setFieldPicks(buildDefaultPicks(mergeSource!, game));
  };

  const togglePick = (key: MergeFieldKey, pick: FieldPick) => {
    setFieldPicks((prev) => (prev ? { ...prev, [key]: pick } : prev));
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    setMerging(true);
    try {
      await api.post(`/api/admin/boardgames/${mergeSource.id}/merge`, {
        targetId: mergeTarget.id,
        fieldPicks,
      });
      toast.success(`"${mergeSource.name}" fusionné dans "${mergeTarget.name}"`);
      setMergeSource(null);
      setFieldPicks(null);
      fetchGames();
    } catch {
      toast.error("Échec de la fusion");
    } finally {
      setMerging(false);
    }
  };

  // Compute field rows for the picker (only shown when both source and target are selected)
  const mergeFieldRows =
    mergeSource && mergeTarget
      ? (
          [
            {
              key: "name" as MergeFieldKey,
              label: "Nom",
              src: mergeSource.name,
              tgt: mergeTarget.name,
            },
            {
              key: "yearPublished" as MergeFieldKey,
              label: "Année",
              src: mergeSource.yearPublished?.toString() ?? null,
              tgt: mergeTarget.yearPublished?.toString() ?? null,
            },
            {
              key: "minPlayers" as MergeFieldKey,
              label: "Joueurs min",
              src: mergeSource.minPlayers?.toString() ?? null,
              tgt: mergeTarget.minPlayers?.toString() ?? null,
            },
            {
              key: "maxPlayers" as MergeFieldKey,
              label: "Joueurs max",
              src: mergeSource.maxPlayers?.toString() ?? null,
              tgt: mergeTarget.maxPlayers?.toString() ?? null,
            },
            {
              key: "playingTime" as MergeFieldKey,
              label: "Durée (min)",
              src: mergeSource.playingTime?.toString() ?? null,
              tgt: mergeTarget.playingTime?.toString() ?? null,
            },
            {
              key: "imageUrl" as MergeFieldKey,
              label: "Image",
              src: mergeSource.imageUrl,
              tgt: mergeTarget.imageUrl,
              isImage: true,
            },
            {
              key: "externalRef" as MergeFieldKey,
              label: "Source ext.",
              src: mergeSource.externalSource
                ? `${mergeSource.externalSource} #${mergeSource.externalId ?? "?"}`
                : null,
              tgt: mergeTarget.externalSource
                ? `${mergeTarget.externalSource} #${mergeTarget.externalId ?? "?"}`
                : null,
            },
          ] as {
            key: MergeFieldKey;
            label: string;
            src: string | null;
            tgt: string | null;
            isImage?: boolean;
          }[]
        ).filter((f) => {
          if (f.key === "name") return true;
          if (f.src == null && f.tgt == null) return false;
          if (f.src === f.tgt) return false;
          return true;
        })
      : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          className="input input-bordered input-sm flex-1"
          placeholder="Rechercher un jeu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-sm" />
        </div>
      )}

      {!loading && result && (
        <>
          <p className="text-xs opacity-60">
            {result.total} jeu{result.total !== 1 ? "x" : ""} au total
          </p>

          {result.games.length === 0 && (
            <EmptyState
              icon={<span>🔍</span>}
              title="Aucun résultat"
              description={
                search
                  ? `Aucun jeu ne correspond à "${search}".`
                  : "Aucun jeu dans la base pour l'instant."
              }
            />
          )}

          <div className="space-y-2">
            {result.games.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-2 p-3 bg-base-200 border border-base-300 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{game.name}</p>
                  <p className="text-xs opacity-60">
                    {[
                      game.yearPublished,
                      game.minPlayers != null && game.maxPlayers != null
                        ? `${game.minPlayers}-${game.maxPlayers}J`
                        : null,
                      game.playingTime != null ? `${game.playingTime}min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {game.externalSource && (
                      <span className="badge badge-ghost badge-xs ml-1">{game.externalSource}</span>
                    )}
                  </p>
                  <p className="text-xs opacity-50">
                    {game._count.eventBoardGames} événement
                    {game._count.eventBoardGames !== 1 ? "s" : ""} · {game._count.gameTables} table
                    {game._count.gameTables !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="btn btn-ghost btn-xs gap-1" onClick={() => openEdit(game)}>
                    <PencilIcon className="w-3.5 h-3.5" />
                    Éditer
                  </button>
                  <button
                    className="btn btn-ghost btn-xs gap-1 text-info"
                    onClick={() => openMerge(game)}
                  >
                    <MergeIcon className="w-3.5 h-3.5" />
                    Fusionner
                  </button>
                  <button
                    className="btn btn-ghost btn-xs gap-1 text-error"
                    onClick={() => setDeleteTarget(game)}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                className="btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                «
              </button>
              <span className="btn btn-sm btn-ghost no-animation">
                {page}/{totalPages}
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                »
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      <ResponsiveModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Modifier le jeu"
      >
        <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
          <div className="form-control">
            <label className="label" htmlFor="abg-name">
              <span className="label-text">Nom</span>
            </label>
            <input
              id="abg-name"
              type="text"
              className="input input-bordered w-full"
              {...register("name", { required: "Requis" })}
            />
            {editErrors.name && (
              <label className="label">
                <span className="label-text-alt text-error">{editErrors.name.message}</span>
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label" htmlFor="abg-year">
                <span className="label-text">Année</span>
              </label>
              <input
                id="abg-year"
                type="number"
                className="input input-bordered w-full"
                {...register("yearPublished")}
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="abg-time">
                <span className="label-text">Durée (min)</span>
              </label>
              <input
                id="abg-time"
                type="number"
                className="input input-bordered w-full"
                {...register("playingTime")}
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="abg-min">
                <span className="label-text">Joueurs min</span>
              </label>
              <input
                id="abg-min"
                type="number"
                className="input input-bordered w-full"
                {...register("minPlayers")}
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="abg-max">
                <span className="label-text">Joueurs max</span>
              </label>
              <input
                id="abg-max"
                type="number"
                className="input input-bordered w-full"
                {...register("maxPlayers")}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn" onClick={() => setEditTarget(null)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
              Enregistrer
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Delete confirmation modal */}
      <ResponsiveModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le jeu"
      >
        {deleteTarget && (
          <div className="p-4 md:p-0 md:mt-4 space-y-4">
            <p className="text-sm">
              Supprimer <strong>{deleteTarget.name}</strong> ?
            </p>
            {(deleteTarget._count.eventBoardGames > 0 || deleteTarget._count.gameTables > 0) && (
              <div className="alert alert-warning">
                <span className="text-sm">
                  Impact : {deleteTarget._count.eventBoardGames} entrée
                  {deleteTarget._count.eventBoardGames !== 1 ? "s" : ""} événement supprimée
                  {deleteTarget._count.eventBoardGames !== 1 ? "s" : ""},{" "}
                  {deleteTarget._count.gameTables} table
                  {deleteTarget._count.gameTables !== 1 ? "s" : ""} déliée
                  {deleteTarget._count.gameTables !== 1 ? "s" : ""}.
                </span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Annuler
              </button>
              <button className="btn btn-error" onClick={handleDelete} disabled={deleting}>
                {deleting ? <span className="loading loading-spinner loading-xs" /> : "Supprimer"}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Merge modal */}
      <ResponsiveModal
        open={mergeSource !== null}
        onClose={() => {
          setMergeSource(null);
          setFieldPicks(null);
        }}
        title="Fusionner le jeu"
        size="lg"
      >
        {mergeSource && (
          <div className="p-4 md:p-0 md:mt-4 space-y-4">
            {!mergeTarget ? (
              /* Step 1: search for target */
              <>
                <p className="text-sm">
                  Fusionner <strong>{mergeSource.name}</strong> dans...
                </p>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Chercher le jeu cible..."
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  autoFocus
                />
                {mergeResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {mergeResults.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className="w-full text-left p-2 hover:bg-base-200 rounded text-sm"
                        onClick={() => selectMergeTarget(g)}
                      >
                        <span className="font-medium">{g.name}</span>
                        {g.yearPublished && (
                          <span className="opacity-50 ml-1">({g.yearPublished})</span>
                        )}
                        <span className="opacity-50 text-xs ml-2">
                          {g._count.eventBoardGames}E · {g._count.gameTables}T
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {mergeSearch && mergeResults.length === 0 && (
                  <p className="text-sm opacity-50">Aucun résultat</p>
                )}
              </>
            ) : (
              /* Step 2: field picker */
              <>
                {/* Column headers */}
                <div className="grid grid-cols-[90px_1fr_1fr] gap-2">
                  <span />
                  <div className="text-xs font-medium bg-base-200 rounded px-2 py-1 text-center truncate">
                    {mergeSource.name}
                  </div>
                  <div className="text-xs font-medium bg-base-200 rounded px-2 py-1 text-center truncate">
                    {mergeTarget.name}
                  </div>
                </div>

                {/* Field rows */}
                {mergeFieldRows.map(({ key, label, src, tgt, isImage }) => {
                  const srcPicked = fieldPicks![key] === "source";
                  const tgtPicked = fieldPicks![key] === "target";
                  const srcDisabled = src == null;
                  const tgtDisabled = tgt == null;

                  return (
                    <div key={key} className="grid grid-cols-[90px_1fr_1fr] gap-2 items-center">
                      <span className="text-xs opacity-50 text-right pr-2">{label}</span>

                      <button
                        type="button"
                        disabled={srcDisabled}
                        onClick={() => togglePick(key, "source")}
                        className={`relative rounded p-2 text-sm text-center min-h-[2.5rem] transition-colors border ${
                          srcDisabled
                            ? "bg-base-200 border-base-300 opacity-30 cursor-default"
                            : srcPicked
                              ? "bg-primary/15 border-primary ring-2 ring-primary/40"
                              : "bg-base-100 border-base-300 hover:bg-base-300"
                        }`}
                      >
                        {srcPicked && (
                          <span className="absolute top-1 right-1 text-primary">
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        )}
                        {isImage && src ? (
                          <img
                            src={src}
                            alt=""
                            className="h-10 w-10 object-cover mx-auto rounded"
                          />
                        ) : (
                          <span>{src ?? "—"}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={tgtDisabled}
                        onClick={() => togglePick(key, "target")}
                        className={`relative rounded p-2 text-sm text-center min-h-[2.5rem] transition-colors border ${
                          tgtDisabled
                            ? "bg-base-200 border-base-300 opacity-30 cursor-default"
                            : tgtPicked
                              ? "bg-primary/15 border-primary ring-2 ring-primary/40"
                              : "bg-base-100 border-base-300 hover:bg-base-300"
                        }`}
                      >
                        {tgtPicked && (
                          <span className="absolute top-1 right-1 text-primary">
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        )}
                        {isImage && tgt ? (
                          <img
                            src={tgt}
                            alt=""
                            className="h-10 w-10 object-cover mx-auto rounded"
                          />
                        ) : (
                          <span>{tgt ?? "—"}</span>
                        )}
                      </button>
                    </div>
                  );
                })}

                <p className="text-xs opacity-50">
                  Toutes les liaisons (événements, tables) seront transférées.
                </p>

                <div className="flex gap-2 justify-between">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setMergeTarget(null);
                      setFieldPicks(null);
                    }}
                    disabled={merging}
                  >
                    ← Changer la cible
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="btn"
                      onClick={() => {
                        setMergeSource(null);
                        setFieldPicks(null);
                      }}
                      disabled={merging}
                    >
                      Annuler
                    </button>
                    <button className="btn btn-warning" onClick={handleMerge} disabled={merging}>
                      {merging ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        "Confirmer la fusion"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}
