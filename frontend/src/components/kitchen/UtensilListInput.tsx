import ChipAutocompleteInput from "../common/ChipAutocompleteInput";

interface Props {
  value: string[];
  onChange: (utensils: string[]) => void;
}

// Catalogue reutilisable d'ustensiles entre events (Evolutions.md point 7), meme
// pattern find-or-create/dedup que les ingredients (Product) et les tags.
export default function UtensilListInput({ value, onChange }: Props) {
  return (
    <ChipAutocompleteInput
      value={value}
      onChange={onChange}
      searchEndpoint="/api/kitchen/utensils"
      placeholder="Ajouter des ustensiles..."
      removeLabel={(utensil) => `Retirer l'ustensile ${utensil}`}
      createHintLabel={(input) => `Aucun ustensile existant — Entrée pour créer "${input}"`}
      searchErrorLabel="Recherche d'ustensiles indisponible"
      badgeClassName="badge-outline"
    />
  );
}
