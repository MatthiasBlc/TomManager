# Prochaines etapes - TomManager

Phases terminees : 1-13, 15a, 15b, 15c. Phase 9 (Emails) ignoree — remplacee par Discord.
Feature `waitlist-manual-control` : complete (UI mise a jour : bloc waitlist separe du bloc participants). Spec : `docs/features/waitlist-manual-control/SPEC_WAITLIST_MANUAL_CONTROL.md`
Feature `upgrade-tailwind-daisyui` : complete. Spec : `docs/features/upgrade-tailwind-daisyui/SPEC_UPGRADE_TAILWIND_DAISYUI.md`
Historique des phases : `CHANGELOG.md`

---

## Phase 14 : Migration API BoardGameGeek (Priorite haute)

**Contexte** : Depuis juillet 2025, BGG exige un Bearer Token sur toutes les requetes `boardgamegeek.com/xmlapi2/*`.
La structure XML v2 est inchangee — seule l'auth est nouvelle. La recherche BGG est actuellement silencieusement cassee (retourne `[]`).

Spec complete : `docs/features/bgg-migration/SPEC_BGG_MIGRATION.md`
Roadmap detaillee : `docs/features/bgg-migration/ROADMAP.md`

**Prerequis bloquant** : Enregistrer TomManager sur `https://boardgamegeek.com/applications/create` et obtenir le Bearer Token.

- [ ] Enregistrer l'app BGG et obtenir le Bearer Token
- [ ] Ajouter `BGG_API_TOKEN` en variable d'environnement (env.ts, .env, docker-compose.yml x3, GitHub Secrets)
- [ ] Refactorer `bgg.ts` : Bearer header, retry sur 202, backoff sur 429, log sur 401
- [ ] Installer `he` et sanitiser les descriptions HTML de BGG avant stockage
- [ ] Normaliser les imageUrl `//cdn...` → `https://cdn...`
- [ ] Warning au demarrage si `BGG_API_TOKEN` absent (degraded mode)
- [ ] Tests unitaires `bgg.test.ts` (14 scenarios avec vi.stubGlobal fetch)
- [ ] Test live manuel avec vrai token
- [ ] E2E `boardgames.spec.ts` : search + ajout via BGG

**En attendant** : utiliser "Create manually" pour ajouter des jeux.

---

## Feature : Refonte JDS — banque de jeux, BGG et liaisons tables

**Statut** : partiellement complete. Spec : `docs/features/jds-rework/SPEC_JDS_REWORK.md`
Roadmap detaillee : `docs/features/jds-rework/ROADMAP.md`

- [x] **C — Admin banque** : CRUD admin `/api/admin/boardgames` + panel dans ProfilePage
- [x] **A — Liaison table ↔ jeu** : migration DB `boardGameId` sur `GameTable`, selecteur dans formulaires tables JDS
- [x] **B — Games enrichi** : `BoardGameDetailModal`, badge tables, tri/filtres dans `BoardGameTab`
- [ ] **D — BGG fix** : bearer token, retry 202/429, flag `bggAvailable`, fetch complet a l'import — **bloque sur obtention du Bearer Token BGG**
- [ ] **Logo "Powered by BGG"** : affichage obligatoire dans BoardGameTab, BoardGameDetailModal, BoardGameSearchInput (condition contractuelle BGG)

---

## Phase 16 : Features avancees (Priorite basse, a discuter)

- [ ] **Export** : export PDF du planning d'un event
- [ ] **Historique** : log des actions sur un event
- [ ] **PWA avancee** : service worker, cache offline, push notifications

---

## Optionnel (futur) : etudier le remplacement de @fullcalendar par une solution custom

**Modele reco : Opus 4.6 | Effort : 4-6h**

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

**Modele reco : Sonnet 4.6 | Effort : 2-4h**
