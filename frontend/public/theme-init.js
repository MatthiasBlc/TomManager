// Applique le theme enregistre AVANT le premier rendu, pour eviter le flash de
// theme clair au chargement. Fichier externe et non script inline : la CSP de
// production (script-src 'self', cf frontend/Dockerfile) bloque tout inline, ce qui
// rendait ce code silencieusement inoperant en prod. Doit rester charge en
// bloquant dans <head> (ni defer ni async) pour passer avant la peinture.
try {
  var t = localStorage.getItem("app_theme");
  document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "ToM");
} catch {
  document.documentElement.setAttribute("data-theme", "ToM");
}
