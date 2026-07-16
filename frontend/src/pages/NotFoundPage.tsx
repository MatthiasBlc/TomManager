import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Page introuvable");
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold opacity-20">404</h1>
        <h2 className="text-2xl font-semibold">Page introuvable</h2>
        <p className="opacity-60">Cette page n'existe pas ou a été déplacée.</p>
        <Link to="/" className="btn btn-primary">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
