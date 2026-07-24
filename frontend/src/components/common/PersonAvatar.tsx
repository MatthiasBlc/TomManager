interface Props {
  name: string;
  className?: string;
}

// Pastille d'initiales (maquette Cuisine) : reprise partout ou une personne est
// listee (roster chefs/courses/sans affectation, chef d'une fiche repas, MJ de
// table, etc.).
export default function PersonAvatar({ name, className = "" }: Props) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[0.62rem] font-bold shrink-0 ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
