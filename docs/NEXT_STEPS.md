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

## Feature : Refonte JDS — banque de jeux, BGG et liaisons tables (A dégrossir)

**Statut** : a specifier. Ne pas coder avant d'avoir une spec complete par sous-feature.

**Modele reco : Opus 4.6 | Effort : 8h+ (multi-domaines, migrations DB)**

### Contexte et diagnostic

La partie "jeux de societe" est incomplete sur plusieurs axes independants mais lies :

1. **BGG casse** (Phase 14 deja documentee) — recherche BGG silencieusement en echec depuis juil. 2025
2. **Pas de liaison Table JDS → BoardGame** — une table de type JDS ne peut pas etre associee a un jeu specifique
3. **Pas d'interface admin de la banque de jeux** — aucun CRUD global sur les BoardGame en DB
4. **Onglet Games incomplet** — pas de lien visible entre jeux apportes et tables JDS qui les jouent

---

### Sous-feature 1 : Liaison GameTable ↔ BoardGame

**Probleme** : Une table de type JDS existe independamment des jeux. Il est impossible de savoir quel
jeu est joue a quelle table, ni de pre-remplir les infos (nb joueurs, duree) a partir du jeu.

**Questions a trancher avant de coder** :
- La liaison est-elle 1 table → 1 jeu (champ `boardGameId` nullable sur `GameTable`) ou N:N ?
- Le jeu lie doit-il etre dans la banque de l'event ou dans la banque globale ?
- Pre-remplissage automatique de `maxPlayers` et duree depuis le jeu BGG ?
- Affichage dans `TableCard` et `TableDetailModal` : juste le nom du jeu, ou image + stats aussi ?
- Dans `CreateTableModal` (type JDS) : selecteur du jeu parmi les jeux de l'event, ou recherche globale ?

**Impact DB** :
- Migration : ajouter `boardGameId String? FK -> BoardGame.id` sur `GameTable`
- Contrainte onDelete : SET NULL (si le jeu est retire, la table reste)

**Impact backend** :
- Schema Zod `createTable` / `updateTable` : champ optionnel `boardGameId`
- Service `gameTable.ts` : inclure `boardGame` dans les includes du `findUnique`
- API : retourner les infos du jeu lie dans GET /:tableId

**Impact frontend** :
- `CreateTableModal` : quand type=JDS, afficher un selecteur de jeu (depuis `/api/events/:id/boardgames`)
- `EditTableModal` : idem
- `TableDetailModal` : afficher le jeu lie (image + nom + stats) si present
- `TableCard` : badge ou sous-titre avec le nom du jeu

---

### Sous-feature 2 : Interface admin — banque de jeux globale

**Probleme** : Les admins ne peuvent gerer les BoardGame qu'en passant par l'interface d'un event.
Il n'existe pas de page de gestion de la banque globale.

**Questions a trancher** :
- Page dediee `/admin/boardgames` ou section dans une future page `/admin` ?
- Quelles actions admin : liste, edit (nom, annee, joueurs, image), delete, merge doublons ?
- Suppression : hard delete ou soft delete ? Que faire si le jeu est lie a des events ?
- Import en masse depuis BGG : utile ? ou garder le flow actuel (ajout a la demande) ?
- Qui peut editer : ADMIN seul, ou n'importe quel user peut "proposer une correction" ?

**Impact backend** :
- Nouveaux endpoints admin : `PATCH /api/boardgames/:id`, `DELETE /api/boardgames/:id`
- Auth : `requireAdmin` obligatoire
- Logique de suppression : bloquer si le jeu est reference dans des EventBoardGame ou GameTable

**Impact frontend** :
- Nouvelle page ou composant admin
- Tableau paginé/filtre des BoardGame
- Formulaire d'edition inline ou modal

---

### Sous-feature 3 : Onglet Games — vue enrichie et liaisons tables

**Probleme** : L'onglet Games d'un event liste les jeux apportes mais sans lien avec les tables JDS.
Un participant ne peut pas savoir si un jeu a deja une table organisee, ni qui y joue.

**Questions a trancher** :
- Afficher sur chaque `BoardGameCard` : les tables JDS qui jouent ce jeu (avec lien/click) ?
- Depuis la table JDS, lien retour vers le jeu dans l'onglet Games ?
- Description du jeu : afficher dans un modal de detail au click ? (lazy fetch BGG via GET /:id)
- Tri/filtre dans l'onglet Games : par nom, par nb joueurs, par "a une table" ?
- Badge "table organisee" sur la carte si une table JDS est liee a ce jeu ?

**Impact backend** :
- GET `/api/events/:id/boardgames` : enrichir avec les tables JDS liees (si sous-feature 1 faite)

**Impact frontend** :
- `BoardGameCard` : afficher les tables JDS liees
- Modal de detail jeu : image grande, description, stats, tables liees
- Filtres/tri dans `BoardGameTab`

---

### Sous-feature 4 : BGG — fix auth + ameliorations UX

Voir Phase 14 deja documentee pour le fix technique (bearer token, retry 202/429).

**Questions UX supplementaires a trancher** :
- Afficher un indicateur "BGG indisponible" dans l'UI de recherche si token absent ?
- Dans les resultats de recherche, differencier visuellement les jeux locaux vs BGG ?
- Apres import d'un jeu BGG, lazy-fetch automatique de la description/image au moment de l'ajout
  (et non uniquement au GET /:id) ?

---

### Ordre de travail suggere (a confirmer)

1. Phase 14 (BGG fix) — prerequis technique pour les autres sous-features
2. Sous-feature 1 (liaison table ↔ jeu) — valeur utilisateur directe, migration DB simple
3. Sous-feature 3 (onglet Games enrichi) — depend de 1 pour les liaisons tables
4. Sous-feature 2 (admin banque) — utile mais moins urgent, peut attendre

**Chaque sous-feature doit avoir sa propre spec dans `docs/features/` avant implementation.**

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
