import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Remonte en haut de page a chaque changement de route. On ne reagit qu'au
// pathname : un changement de search params (ex. ?tab=) ne doit pas scroller.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
