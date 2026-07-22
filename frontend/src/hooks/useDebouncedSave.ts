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

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timeout = setTimeout(async () => {
      setStatus("saving");
      try {
        await onSave(value);
        setStatus("saved");
        if (flashTimeout.current) clearTimeout(flashTimeout.current);
        flashTimeout.current = setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("error");
      }
    }, delayMs);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  useEffect(() => {
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, []);

  return status;
}
