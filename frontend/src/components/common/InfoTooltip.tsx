import { useState } from "react";

// Icone info avec infobulle : hover sur desktop, tap sur mobile (toggle tooltip-open)
export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`tooltip tooltip-bottom before:max-w-[16rem] before:whitespace-normal before:text-left ${
        open ? "tooltip-open" : ""
      }`}
      data-tip={text}
    >
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle opacity-60"
        aria-label="Plus d'informations"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </span>
  );
}
