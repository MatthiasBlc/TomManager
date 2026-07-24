import ChipAutocompleteInput from "../common/ChipAutocompleteInput";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ value, onChange }: Props) {
  return (
    <ChipAutocompleteInput
      value={value}
      onChange={onChange}
      searchEndpoint="/api/tags"
      placeholder="Ajouter des tags..."
      removeLabel={(tag) => `Retirer le tag ${tag}`}
      createHintLabel={(input) => `Aucun tag existant — Entrée pour créer "${input}"`}
      searchErrorLabel="Recherche de tags indisponible"
      badgeClassName="badge-primary"
    />
  );
}
