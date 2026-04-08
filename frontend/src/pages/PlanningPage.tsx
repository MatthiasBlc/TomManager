import { useParams, useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import PlanningTab from "../components/planning/PlanningTab";

export default function PlanningPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="mb-4 md:mb-6">
        {!isMobile && (
          <button
            className="btn btn-ghost btn-sm mb-2"
            onClick={() => navigate(`/events/${eventId}`)}
          >
            &larr; Back to event
          </button>
        )}
        <h1 className="text-xl font-bold md:text-2xl">Planning</h1>
      </div>

      <PlanningTab eventId={eventId!} />
    </div>
  );
}
