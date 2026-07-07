import { type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import MobileSheet from "./MobileSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}

const SIZE_CLASSES = {
  md: "",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function ResponsiveModal({ open, onClose, title, children, size = "md" }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title={title}>
        {children}
      </MobileSheet>
    );
  }

  if (!open) return null;

  return (
    <dialog className="modal modal-open" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal-box overflow-x-hidden ${SIZE_CLASSES[size]}`}>
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>
        <h3 className="font-bold text-lg pr-8">{title}</h3>
        {children}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
