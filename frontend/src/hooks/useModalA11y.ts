import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessibilite commune aux modales (MobileSheet et ResponsiveModal desktop) :
// fermeture Echap, focus trap Tab/Shift+Tab, auto-focus du premier element
// focusable, restauration du focus a la fermeture.
export function useModalA11y(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
