import { useState } from "react";
import toast from "react-hot-toast";
import { downloadFile } from "../../config/api";
import { getErrorMessage } from "../../config/apiErrors";
import { useShoppingList } from "../../hooks/useShoppingList";
import { SkeletonCardGrid } from "../common/Skeleton";
import EmptyState from "../common/EmptyState";
import { UtensilsIcon, SortIcon, MergeIcon, FileTextIcon } from "../common/icons";
import CoursesByMealView from "./CoursesByMealView";
import CoursesFlatView from "./CoursesFlatView";
import CoursesAggregatedView from "./CoursesAggregatedView";

// Les valeurs sont celles attendues par ?view= cote backend : un seul vocabulaire
// entre le selecteur, l'URL d'export et le nom de feuille du fichier.
type ViewMode = "by-meal" | "flat" | "aggregated";

const VIEWS: { mode: ViewMode; label: string; icon: typeof UtensilsIcon }[] = [
  { mode: "by-meal", label: "Par repas", icon: UtensilsIcon },
  { mode: "flat", label: "Tous les ingrédients (A-Z)", icon: SortIcon },
  { mode: "aggregated", label: "Ingrédients regroupés", icon: MergeIcon },
];

const VIEW_PREF_KEY = "courses_view_preference";

function getStoredView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_PREF_KEY);
    return VIEWS.some((v) => v.mode === stored) ? (stored as ViewMode) : "by-meal";
  } catch {
    return "by-meal";
  }
}

export default function CoursesTab({ eventId }: { eventId: string }) {
  const { data, loading } = useShoppingList(eventId);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredView);
  const [exporting, setExporting] = useState(false);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_PREF_KEY, mode);
    } catch {
      // localStorage indisponible : la vue reste simplement non memorisee
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile(
        `/api/events/${eventId}/kitchen/shopping/export?view=${viewMode}`,
        `courses-${viewMode}.xlsx`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Échec de l'export"));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <SkeletonCardGrid count={3} />;

  const hasMeals = data !== null && data.byMeal.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-base-300 p-0.5 gap-0.5">
          {VIEWS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              className={`btn btn-xs btn-square ${viewMode === mode ? "btn-primary" : "btn-ghost"}`}
              onClick={() => switchView(mode)}
              aria-label={label}
              aria-pressed={viewMode === mode}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <button
          className="btn btn-ghost btn-sm gap-1.5"
          onClick={handleExport}
          disabled={exporting || !hasMeals}
          title={`Exporter la vue "${VIEWS.find((v) => v.mode === viewMode)?.label}" en Excel`}
        >
          {exporting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <FileTextIcon className="w-4 h-4" />
          )}
          Exporter en Excel
        </button>
      </div>

      {!hasMeals ? (
        <EmptyState
          title="Aucun repas planifié pour le moment"
          description="La liste de courses se remplira dès que les créneaux de repas seront générés."
        />
      ) : viewMode === "by-meal" ? (
        <CoursesByMealView meals={data.byMeal} />
      ) : viewMode === "flat" ? (
        <CoursesFlatView lines={data.flat} />
      ) : (
        <CoursesAggregatedView lines={data.aggregated} />
      )}
    </div>
  );
}
