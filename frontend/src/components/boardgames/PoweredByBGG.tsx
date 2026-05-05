export default function PoweredByBGG({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center opacity-70 hover:opacity-100 transition-opacity ${className}`}
      aria-label="Powered by BoardGameGeek"
    >
      <img src="/poweredByBGG.webp" alt="Powered by BoardGameGeek" className="h-10" />
    </a>
  );
}
