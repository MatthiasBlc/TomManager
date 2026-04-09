# Prochaines etapes - TomManager

Phases terminees : 1-13, 15a, 15b. Phase 9 (Emails) ignoree — remplacee par Discord.
Feature `waitlist-manual-control` : complete. Spec : `docs/features/waitlist-manual-control/SPEC_WAITLIST_MANUAL_CONTROL.md`
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

## Discord OAuth popup (Priorite basse)

**Modele reco : Sonnet 4.6 | Effort : 1-2h**

**Contexte** : La page Discord s'affiche 1-2s meme quand l'utilisateur est deja connecte (incontournable cote Discord). L'approche popup evite la navigation complete hors de TomManager.

**Comportement cible** :

- Desktop : ouvre un popup Discord, la page principale reste visible, le popup se ferme une fois connecte
- Mobile / popup bloque : fallback automatique vers le flux redirect actuel (comportement inchange)

**Implementation** :

- Frontend : tenter `window.open()`, si bloque ou echec → `window.location.href` (redirect normal)
- Backend callback : detecter si appel depuis popup (param `?popup=1`), renvoyer une page HTML minimale avec `window.opener.postMessage` + `window.close()` au lieu de rediriger
- Frontend : ecouter `postMessage`, mettre a jour l'AuthContext, rediriger vers la destination

---

## Phase 16 : Features avancees (Priorite basse, a discuter)

- [ ] **Export** : export PDF du planning d'un event
- [ ] **Historique** : log des actions sur un event
- [ ] **PWA avancee** : service worker, cache offline, push notifications
- [x] **Dark/Light mode** : toggle theme DaisyUI (complete : useTheme.ts, themes coffee/winter)

---

## Optionnel : remplacer axios par un wrapper fetch custom

**Modele reco : Sonnet 4.6 | Effort : 2h**

**Context** : Le projet utilise axios (`src/config/api.ts`) pour les requetes HTTP.
Axios apporte surtout de la convenance (timeouts, intercepteurs, etc.), mais fetch moderne
peut faire 95% des memes choses sans dependance externe.

**Refacto proposee** :

1. Creer un wrapper fetch minimaliste (30 lignes) avec les memes methodes : `get()`, `post()`, `delete()`, `put()`
2. Garder `src/config/api.ts` comme point d'entree (meme interface)
3. Ajouter une couche d'intercepteurs auth au niveau du Provider React si besoin
4. Supprimer `axios` de `package.json`
5. Tests existants resteront valides (les mocks de `../config/api` restent identiques)

**Avantages** : une dependance de moins, moins de surface d'attaque, code plus clair.
**Mise en garde** : `.data` utilise en 80+ endroits — le wrapper doit preserver cette interface.

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
