import { useParams, useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import PlanningTab from "../components/planning/PlanningTab";

export default function PlanningPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div
      className={`container mx-auto px-4 ${
        isMobile ? "py-4" : "pt-4 md:pt-6 h-[calc(100dvh-4rem)] flex flex-col"
      }`}
    >
      <div className="mb-4 md:mb-5 flex-none">
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

      <div className={!isMobile ? "flex-1 min-h-0" : ""}>
        <PlanningTab eventId={eventId!} />
      </div>
    </div>
  );
}
