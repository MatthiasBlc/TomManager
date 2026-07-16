# Prochaines etapes - TomManager

**Version 1.0 lancee.** Toutes les phases et features prevues sont terminees et integrees.
Historique utilisateur : `docs/changelogs/`.

---

## Phase 16 : Features avancees (Priorite basse, a discuter)

- [ ] **Export** : export PDF du planning d'un event
- [ ] **Historique** : log des actions sur un event
- [ ] **PWA avancee** : service worker, cache offline, push notifications

---

## Optionnel (futur) : etudier le remplacement de @fullcalendar par une solution custom

**Modele reco : Opus 4.8 | Effort : 4-6h**

**Context** : FullCalendar est une dependance lourde utilisee dans CalendarView/PlanningTab.
Le projet ne l'exploite qu'a 10% : affichage d'une timeline simple d'evenements.
Un composant React custom + CSS grid pourrait faire la meme chose avec beaucoup moins de poids.

**Avant de commencer** :

- Creer une branche dediee (`feature/custom-calendar` ou similaire)
- Documenter exactement ce que FullCalendar fait actuellement (render, interactions, drag-drop, etc.)
- Verifier les tests e2e (`docs/MANUAL_TESTING.md` ou tests Playwright)

**Criteres de validation** (avant merge) :

- Affichage identique (meme layout, meme style, meme responsivite)
- Toutes les interactions fonctionnent (click, navigation, selection de slots)
- Aucune perte de feature (agenda view, time grid, filtering, etc.)
- Tests e2e passent
- Aucune regression sur les pages qui l'utilisent

**Effort estime** : ~4-6h (exploration + impl + tests). A faire seulement si vraiment necessaire.
**Risque** : refacto complexe, facile de casser quelque chose. Valider en tests avant le moindre commit final.

---

## Optionnel : Export PDF v2 (amelioration du systeme actuel)

**Contexte** : La v1 utilise `window.print()` + CSS `@media print`. Elle fonctionne mais a des limites :
la vue calendrier (FullCalendar) imprime mal ses evenements, et l'orientation est injectee via un `<style>` dynamique.

**Pistes pour v2** :

- Evaluer `@react-pdf/renderer` pour un vrai rendu PDF sans passer par le dialog d'impression
- Ou generer une vue "print-only" dediee (composant React simplifie, optimise pour l'impression)
- Regler proprement le cas FullCalendar (evenements absents en vue calendrier)

**Modele reco : Sonnet 5 | Effort : 2-4h**
