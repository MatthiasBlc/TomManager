interface Props {
  onClick: () => void;
  label: string;
}

export default function FAB({ onClick, label }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 btn btn-primary btn-circle shadow-lg h-14 w-14 text-2xl"
    >
      +
    </button>
  );
}
