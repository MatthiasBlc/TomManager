import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pile des modales ouvertes : quand plusieurs modales sont empilees (ex. un
// ConfirmModal au-dessus d'un formulaire), Echap et le focus trap ne doivent
// agir que sur la modale du dessus.
const modalStack: symbol[] = [];

// Accessibilite commune aux modales (MobileSheet et ResponsiveModal desktop) :
// fermeture Echap, focus trap Tab/Shift+Tab, auto-focus du premier element
// focusable, restauration du focus a la fermeture.
export function useModalA11y(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
) {
  // Jeton d'identite de cette modale dans la pile
  const tokenRef = useRef<symbol>(Symbol("modal"));

  useEffect(() => {
    if (!open) return;
    const token = tokenRef.current;
    modalStack.push(token);
    return () => {
      const idx = modalStack.indexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);
    };
  }, [open]);

  // Close on Escape (uniquement si cette modale est au sommet de la pile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modalStack[modalStack.length - 1] !== tokenRef.current) return;
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus trap + auto-focus + restore focus
  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;

    // Auto-focus first focusable element
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) first.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (modalStack[modalStack.length - 1] !== tokenRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus
      previousFocus?.focus();
    };
  }, [open, containerRef]);
}
