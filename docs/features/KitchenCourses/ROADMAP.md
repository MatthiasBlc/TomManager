# ROADMAP - Onglet Courses (liste de courses)

Spec : `SPEC_KITCHEN_COURSES.md`. Branche de base : `Developement` ->
`feature/kitchen-courses`.

**Aucune migration.** Le modele existe deja (`KitchenCoursesMember`,
`MealIngredient.name/quantity/unit/note`). Rien a relire cote SQL, rien a
repercuter sur `discord-bot/prisma/schema.prisma`.

**Une nouvelle dependance backend** : `exceljs` (MIT). A installer dans le
container backend, puis committer `package.json` + `package-lock.json`.

## Modele par lot

| Lot                            | Modele    | Effort  |
| ------------------------------ | --------- | ------- |
| A (preference `admin.courses`) | Haiku 4.5 | ~30-45m |
| B (service d'agregation + GET) | Opus 4.8  | ~2-3h   |
| C (onglet + 3 vues)            | Sonnet 5  | ~2-3h   |
| D (export .xlsx)               | Sonnet 5  | ~1-2h   |
| E (docs `.claude/` + `docs/`)  | Haiku 4.5 | ~30m    |

Lot A en Haiku : ajout d'une cle dans 5 fichiers, patron deja etabli 4 fois.
Lot B en Opus : c'est le seul endroit avec de la vraie logique (dimensions,
conversion, normalisation des noms, attribution des commentaires) et c'est celui
dont une erreur produit une liste de courses fausse sans que personne ne le voie.
Lots C/D en Sonnet : composants et cablage sur des patrons existants.

Les lots sont sequentiels : C consomme le contrat de B, D reutilise les
structures de B.

---

## Lot A - Preference "Gestion courses"

- [x] `backend/src/schemas/preference.ts` : `admin.courses` dans `PREFERENCE_KEYS`.
- [x] `frontend/src/types/preferences.ts` : cle + `DEFAULT_PREFERENCES` a `false`.
- [x] `frontend/src/hooks/useAdminRights.ts` : `canManageCourses`.
- [x] `frontend/src/pages/ProfilePage.tsx` : ligne dans `ADMIN_RIGHT_ROWS`
      (libelle "Gestion courses" + infobulle) **et** dans `handleMasterToggle`.
- [x] `frontend/src/__tests__/ProfilePage.test.tsx` : objet de preferences en dur
      a completer (il casse sinon).
- [x] Test backend `preference.test.ts` : un USER qui tente `admin.courses`
      recoit 403, un ADMIN 200.

## Lot B - Service d'agregation + endpoint de lecture

- [x] `backend/src/middleware/auth.ts` : `assertCoursesAccess(userId, eventId)` +
      `requireCoursesAccess` (403 `COURSES_ACCESS_REQUIRED`).
- [x] `backend/src/services/shoppingList.ts` :
  - [x] `UNIT_DIMENSIONS` (masse g/kg, volume ml/cl/L, cas, cac, piece) +
        facteurs vers l'unite canonique.
  - [x] `buildShoppingViews(meals)` **pur** -> `{ byMeal, flat, aggregated }`.
  - [x] `getShoppingList(eventId)` : lecture Prisma (repas tries par
        `startDateTime`, ingredients dans l'ordre de saisie) + `Decimal -> number`
        avant tout calcul.
  - [x] Vue 2 : tri `localeCompare("fr", { sensitivity: "base" })`, depart du
        repas en second critere.
  - [x] Vue 3 : cle `(nom normalise, dimension)`, somme en unite canonique,
        rendu dans l'unite de sortie (g/kg, ml/L), arrondi 3 decimales sans
        zeros de fin, libelle = premiere graphie rencontree.
  - [x] Vue 3 : `mealNames` chronologiques + `notes` attribuees
        (`{ mealName, note }`), commentaires vides ecartes.
- [x] `controllers/kitchen.ts` (ou `controllers/shoppingList.ts`) + route
      `GET /api/events/:eventId/kitchen/shopping`.
- [x] `frontend/src/config/apiErrors.ts` : message francais pour
      `COURSES_ACCESS_REQUIRED` et `INVALID_EXPORT_VIEW`.
- [x] Tests unitaires purs (`__tests__/unit/shoppingList.test.ts`) :
  - [x] conversion masse (500 g + 1 kg = 1,5 kg) et volume (250 ml + 300 ml).
  - [x] cas/cac/piece non convertibles -> lignes distinctes du meme nom.
  - [x] normalisation de casse/espaces sur le nom, libelle = premiere graphie.
  - [x] tri alphabetique insensible aux accents ("Echalote" / "echalote").
  - [x] commentaires attribues au bon repas, vides ecartes.
  - [x] repas sans ingredient : present en vue 1, absent des vues 2 et 3.
  - [x] event sans repas : trois tableaux vides, jamais `null`.
- [x] Tests d'integration (`__tests__/integration/shoppingList.test.ts`) :
      403 pour USER, chef, ADMIN sans la cle, ADMIN avec `admin.kitchen` seul ;
      200 pour membre equipe courses et ADMIN avec `admin.courses`.

## Lot C - Onglet Courses et ses trois vues

- [x] `frontend/src/hooks/useShoppingList.ts` : GET + `useEventSocket`
      (`kitchen:meal-changed`, `kitchen:planning-generated`,
      `kitchen:config-updated`). Ne fetch pas si l'utilisateur n'a pas le droit.
- [x] `frontend/src/components/courses/CoursesTab.tsx` : selecteur 3 positions
      (meme habillage que le toggle du Planning), memorisation
      `courses_view_preference`, `EmptyState` si aucun repas.
- [x] `CoursesByMealView.tsx` / `CoursesFlatView.tsx` /
      `CoursesAggregatedView.tsx` : tableau desktop, cartes empilees mobile
      (`useIsMobile`), commentaire en italique attenue jamais tronque,
      `unitLabel()` pour les unites.
- [x] `pages/EventDetailPage.tsx` : `"courses"` dans `Tab` et `VALID_TABS`,
      onglet rendu **apres** Cuisine, visible si
      `canManageCourses || kitchen.data?.isCoursesMember`.
- [x] Tests frontend : les 3 vues rendent la bonne structure, le selecteur bascule
      et persiste, l'onglet est absent pour un USER classique et present pour un
      membre de l'equipe courses.

## Lot D - Export .xlsx

- [x] `npm i exceljs` dans le container backend, lock committe.
- [x] `backend/src/services/shoppingExport.ts` : un classeur par vue, en-tetes en
      gras + figes, `Quantite` en cellule **numerique**, retour a la ligne actif
      sur la colonne commentaires, largeurs de colonnes.
- [x] Route `GET /api/events/:eventId/kitchen/shopping/export?view=` (memes
      gardes) ; `400 INVALID_EXPORT_VIEW` si la vue est absente/inconnue ;
      `Content-Type` xlsx + `Content-Disposition` avec `filename` ASCII et
      `filename*=UTF-8''` pour les accents.
- [x] `frontend/src/config/api.ts` : helper `downloadFile(url, fallbackName)`
      (fetch `credentials: "include"` -> Blob -> ancre `download` ->
      `revokeObjectURL`) — les helpers existants forcent `res.json()`.
- [x] Bouton "Exporter en Excel" dans `CoursesTab`, exporte la vue affichee,
      etat `loading` pendant la generation.
- [x] Tests backend : 200 + bon `Content-Type` pour chaque vue, 400 sur vue
      inconnue, 403 sans droit, event sans repas -> fichier valide non vide.

## Lot E - Documentation

- [x] `.claude/context/API_MAP.md` : les deux endpoints, `admin.courses` dans la
      liste des cles, les 2 nouveaux codes d'erreur.
- [x] `.claude/context/DB_MODELS.md` : `admin.courses` dans la liste blanche
      `UserPreference` (aucun changement de schema par ailleurs).
- [x] `.claude/context/FILE_MAP.md` : nouveaux fichiers backend et frontend.
- [x] `.claude/context/TESTS.md` : nouvelles suites.
- [x] `.claude/context/PROGRESS.md` : lien vers cette roadmap.
- [x] `docs/features/CookV1/TodoLater.md` : rayer les points "onglet courses",
      "liste de course", "recupere les occurrences d'un meme produit".

## Verifie avant livraison

- [x] `npx tsc --noEmit` backend + frontend
- [x] Suites completes backend + frontend au vert
- [x] Prettier **depuis la racine** (jamais via `docker exec`)
- [x] `npx eslint .` backend + frontend
- [ ] Verification manuelle du fichier exporte : ouvert dans un tableur, accents
      corrects, colonne Quantite reconnue comme nombre (une somme fonctionne)
- [ ] Verification manuelle des droits : un USER classique et un ADMIN sans la
      case cochee ne voient pas l'onglet

## Reste a faire (hors perimetre)

- Aucune notion d'etat "achete" : si le besoin remonte, il faudra un modele
  dedie (l'onglet est strictement en lecture seule aujourd'hui).
- Pas de conversion entre dimensions (cas/cac/piece vers une masse) : cela
  demanderait une densite par produit.
- Les allergies restent hors de l'onglet Courses ; a rouvrir si l'equipe courses
  en exprime le besoin.
