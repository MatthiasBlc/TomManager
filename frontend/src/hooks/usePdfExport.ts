import { useState } from "react";

const PDF_EXPORT_KEY = "pdf_export_enabled";

function getStoredPdfExport(): boolean {
  try {
    return localStorage.getItem(PDF_EXPORT_KEY) === "true";
  } catch {
    return false;
  }
}

export function usePdfExport() {
  const [enabled, setEnabled] = useState<boolean>(getStoredPdfExport);

  const togglePdfExport = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PDF_EXPORT_KEY, String(next));
      } catch {
        // localStorage indisponible
      }
      return next;
    });
  };

  return { pdfExportEnabled: enabled, togglePdfExport };
}
