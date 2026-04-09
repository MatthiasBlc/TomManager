import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// Page intermediaire pour le flux OAuth popup.
// Le backend redirige ici apres le callback Discord.
// Elle emet un postMessage vers la fenetre parente puis se ferme.
export default function OAuthPopupCallbackPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const type = searchParams.get("type") ?? "DISCORD_AUTH_ERROR";
    const error = searchParams.get("error");

    const payload: Record<string, string> = { type };
    if (error) payload.error = error;

    try {
      window.opener?.postMessage(payload, window.location.origin);
    } catch {
      // opener peut etre null si la popup a ete ouverte sans window.open
    }
    window.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
