import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Sauvegarde "a la volee" generique (Evolutions.md point 1) : declenche `onSave`
// `delayMs` apres le dernier changement de `value`, sans jamais requerir de bouton.
// Ne sauvegarde jamais au montage (seuil des changements ulterieurs). `onSave` est
// volontairement absent des deps de l'effet (comme `useEventSocket`) : un consumer
// qui passe une closure inline ne doit pas reinitialiser le debounce a chaque rendu.
export function useDebouncedSave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = 600
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const isFirstRun = useRef(true);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>();
  // Derniere valeur non encore sauvegardee, ou undefined si tout est a jour. Lue par
  // le filet de securite au demontage ci-dessous, d'ou la ref (et non un state).
  const pendingRef = useRef<{ value: T } | undefined>();
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    pendingRef.current = { value };
    const timeout = setTimeout(async () => {
      setStatus("saving");
      // Vide des l'envoi, pas a la reponse : la requete est deja partie, un demontage
      // pendant qu'elle est en vol ne doit pas la renvoyer en double.
      pendingRef.current = undefined;
      try {
        await onSaveRef.current(value);
        setStatus("saved");
        if (flashTimeout.current) clearTimeout(flashTimeout.current);
        flashTimeout.current = setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("error");
      }
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  // Filet de securite au demontage (fermeture de modale, changement d'onglet, sortie
  // de la page) : le debounce ne doit jamais faire perdre une saisie, on envoie donc
  // la derniere valeur encore en attente. Meme principe que les brouillons de
  // MealFichesList. Pas de setStatus ici, le composant n'est plus monte.
  useEffect(() => {
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      const pending = pendingRef.current;
      if (pending) {
        void onSaveRef.current(pending.value).catch(() => undefined);
      }
    };
  }, []);

  return status;
}
