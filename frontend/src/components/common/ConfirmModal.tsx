import ResponsiveModal from "./ResponsiveModal";

export type ConfirmVariant = "danger" | "warning" | "neutral";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onClose: () => void;
}

const VARIANT_CLASSES: Record<ConfirmVariant, string> = {
  danger: "btn-error",
  warning: "btn-warning",
  neutral: "btn-primary",
};

// Remplacant themable de window.confirm : sheet sur mobile, modal DaisyUI sur
// desktop. Fermer (backdrop, Echap, swipe-down, bouton annuler) = annuler.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "neutral",
  onConfirm,
  onClose,
}: Props) {
  return (
    <ResponsiveModal open={open} onClose={onClose} title={title}>
      <div className="p-4 md:p-0 md:mt-4 space-y-4">
        <p className="text-sm whitespace-pre-wrap">{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${VARIANT_CLASSES[variant]}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
