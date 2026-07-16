import { useEffect } from "react";

const BASE_TITLE = "TomManager";

// Pose "<titre> - TomManager" dans l'onglet navigateur et restaure le titre
// de base au demontage de la page.
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} - ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
