import EmptyState from "../common/EmptyState";
import MealFicheEditor from "./MealFicheEditor";

export interface MealFiche {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  maxAssistants: number;
  chef: { id: string; username: string; displayName?: string | null } | null;
  assistants: { id: string; username: string; displayName?: string | null }[];
  remainingSeats: number;
  ingredients?: { name: string; quantity: number; unit: string }[];
  utensils?: { name: string }[];
}

interface Props {
  eventId: string;
  meals: MealFiche[];
  onChanged: () => void;
  eventStartDate?: string;
  eventEndDate?: string;
}

// Liste complete des fiches repas, RW — usage manager-only (section Gestion,
// Evolutions.md points 1/2/6) : "Mon repas" ne montre jamais cette liste au chef,
// qui ne voit que sa propre fiche via MealFicheEditor directement dans KitchenTab.
export default function MealFichesList({
  eventId,
  meals,
  onChanged,
  eventStartDate,
  eventEndDate,
}: Props) {
  if (meals.length === 0) {
    return (
      <EmptyState
        icon={<span>🍽️</span>}
        title="Aucune fiche repas pour l'instant"
        description="Génère le planning ou crée un créneau manuellement pour commencer."
      />
    );
  }

  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <MealFicheEditor
          key={meal.id}
          eventId={eventId}
          meal={meal}
          canEditSchedule
          onChanged={onChanged}
          eventStartDate={eventStartDate}
          eventEndDate={eventEndDate}
        />
      ))}
    </div>
  );
}
