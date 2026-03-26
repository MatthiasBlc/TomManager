import { type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import MobileSheet from "./MobileSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function ResponsiveModal({ open, onClose, title, children }: Props) {
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
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
