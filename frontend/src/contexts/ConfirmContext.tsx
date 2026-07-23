/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import ConfirmModal, { type ConfirmVariant } from "../components/common/ConfirmModal";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type ConfirmDialogFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmDialogFn | null>(null);

// Provider monte une seule fois dans App.tsx : rend un unique ConfirmModal et
// resout la promesse au clic (true) ou a la fermeture (false). Permet un usage
// imperatif 1:1 avec window.confirm : `if (!(await confirmDialog({...}))) return;`
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmDialog = useCallback<ConfirmDialogFn>((opts) => {
    // Une seule confirmation a la fois : une demande concurrente est refusee
    // (equivaut a un annuler), plutot que d'empiler des dialogues
    if (resolveRef.current) return Promise.resolve(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirmDialog}>
      {children}
      <ConfirmModal
        open={options !== null}
        title={options?.title ?? ""}
        message={options?.message ?? ""}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        variant={options?.variant}
        onConfirm={() => settle(true)}
        onClose={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmDialogFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
