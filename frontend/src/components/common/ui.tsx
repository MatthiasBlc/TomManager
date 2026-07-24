import type { ReactNode } from "react";

// Habillage carte partage dans toute l'appli (bordure + ombre douce de la
// maquette Cuisine) : un seul endroit a ajuster si la maquette evolue.
export const CARD =
  "card bg-base-200 border border-base-300 shadow-[0_1px_2px_rgba(0,0,0,.3),0_10px_24px_-12px_rgba(0,0,0,.5)]";

// Label de section "eyebrow" (petites majuscules + filet) de la maquette,
// pour distinguer les titres de section des titres de carte.
export function SectionEyebrow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-base-content/50 shrink-0">{icon}</span>
      <h4 className="text-xs uppercase tracking-wider font-bold text-base-content/60 shrink-0">
        {children}
      </h4>
      <div className="h-px flex-1 bg-base-300" />
    </div>
  );
}
