import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalA11y } from "../../hooks/useModalA11y";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

// Compte-reference partage : plusieurs MobileSheet peuvent etre imbriquees
// (ex. panneau admin ouvert depuis la modale detail d'un event sur mobile).
// Sans compteur, fermer la sheet interne deverrouille le scroll a tort tant
// que la sheet externe est encore ouverte.
let openSheetCount = 0;

function lockBodyScroll() {
  openSheetCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount === 0) {
    document.body.style.overflow = "";
  }
}

export default function MobileSheet({ open, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Echap, focus trap, auto-focus, restauration du focus
  useModalA11y(containerRef, open, onClose);

  // Lock body scroll when open (compte-reference pour les sheets imbriquees)
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  // Swipe-down to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current;
    currentY.current = delta;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentY.current > 100) {
      onClose();
    }
    if (sheetRef.current) {
      // Animer le retour a la position d'origine au lieu de sauter directement
      sheetRef.current.style.transition = "transform 200ms ease-out";
      sheetRef.current.style.transform = "";
    }
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-base-100 rounded-t-xl animate-slide-up max-h-[90vh] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>
        {/* Title */}
        {title && (
          <div className="px-4 pb-2 border-b border-base-200">
            <h3 className="font-semibold text-lg">{title}</h3>
          </div>
        )}
        {/* Content — padding bas pour la safe-area (barre home iOS) */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
