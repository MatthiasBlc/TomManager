import { useEffect, useState } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { AlertTriangleIcon, UtensilsIcon } from "../common/icons";

interface Props {
  allergiesNotes?: string | null;
  dislikesNotes?: string | null;
}

// Les deux fiches saisies par le responsable, telles que le chef les lit avant
// de cuisiner. Rouge pour les allergies (medical, bloquant), bleu pour les
// aversions (preference de confort) : la couleur porte la moitie du tri, le
// chef n'a plus a relire un pave pour trouver ce qui est vital.
//
// `whitespace-pre-line` est indispensable ici : le responsable saisit une ligne
// par convive dans un textarea, et sans lui le HTML recolle tout en un seul
// paragraphe (c'est exactement le bug d'origine).
export default function KitchenNotesPanels({ allergiesNotes, dislikesNotes }: Props) {
  const isMobile = useIsMobile();
  // Replie par defaut sur mobile uniquement : la liste des aversions est longue
  // et repousserait le reste de l'ecran hors de vue. Les allergies, elles, ne
  // se replient jamais.
  const [dislikesOpen, setDislikesOpen] = useState(!isMobile);

  useEffect(() => {
    setDislikesOpen(!isMobile);
  }, [isMobile]);

  const allergies = allergiesNotes?.trim();
  const dislikes = dislikesNotes?.trim();

  if (!allergies && !dislikes) return null;

  // Une seule fiche renseignee : elle prend toute la largeur plutot que de
  // laisser une demi-colonne vide.
  const bothFilled = !!allergies && !!dislikes;

  return (
    <div className={`grid gap-3 items-start ${bothFilled ? "md:grid-cols-2" : ""}`}>
      {allergies && (
        <div className="card border border-error/30 bg-error/10">
          <div className="card-body p-3 gap-2">
            <p className="flex items-center gap-2 font-semibold text-sm text-error">
              <AlertTriangleIcon className="w-4 h-4 shrink-0" />
              Allergies
            </p>
            <p className="text-sm whitespace-pre-line">{allergies}</p>
          </div>
        </div>
      )}

      {dislikes &&
        (isMobile ? (
          <details
            className="collapse collapse-arrow border border-info/30 bg-info/10"
            open={dislikesOpen}
            onToggle={(e) => setDislikesOpen(e.currentTarget.open)}
          >
            <summary className="collapse-title min-h-0 py-3 flex items-center gap-2 font-semibold text-sm text-info">
              <UtensilsIcon className="w-4 h-4 shrink-0" />
              N'aime vraiment pas
            </summary>
            <div className="collapse-content">
              <p className="text-sm whitespace-pre-line">{dislikes}</p>
            </div>
          </details>
        ) : (
          <div className="card border border-info/30 bg-info/10">
            <div className="card-body p-3 gap-2">
              <p className="flex items-center gap-2 font-semibold text-sm text-info">
                <UtensilsIcon className="w-4 h-4 shrink-0" />
                N'aime vraiment pas
              </p>
              <p className="text-sm whitespace-pre-line">{dislikes}</p>
            </div>
          </div>
        ))}
    </div>
  );
}
