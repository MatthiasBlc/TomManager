# ROADMAP - Repartition vege / carne par repas

Spec : `SPEC_KITCHEN_DIET_SPLIT.md`. Branche de base : `Developement` ->
`feature/kitchen-diet-split`.

Ordre pense pour livrer par couches testables (DB -> API -> UI Gestion ->
notifications -> vues lecture seule). Chaque lot livre ses tests dans le
meme commit (regle CookV1, seuils CI 50%/50% a maintenir).

**Rappel PROD** (spec section 8) : migration 100% additive ; chown
1003:1003 sur le fichier de migration ; relire le SQL ; jamais
`prisma migrate` directement contre la prod.

## Modele par lot

| Lot            | Modele    | Effort    |
| -------------- | --------- | --------- |
| A (DB + API)   | Sonnet 5  | ~1-2h     |
| B (UI Gestion) | Sonnet 5  | ~2-3h     |
| C (Notifs)     | Sonnet 5  | ~1h       |
| D (Vue chef)   | Haiku 4.5 | ~30-45min |
| E (Dashboard)  | Haiku 4.5 | ~30-45min |

---

## Lot A - Fondations DB & API

- [x] Migration Prisma additive : `Meal.vegeCount` / `Meal.carneCount`
      (`Int @default(0)`) + valeur d'enum `KITCHEN_DIET_SPLIT_UPDATED` sur
      `NotificationType`. Uniquement ADD COLUMN / ADD VALUE, aucun
      ALTER/DROP destructif. Relire le SQL genere, chown 1003:1003, tester
      sur la base docker.
- [x] Verifier si `discord-bot/prisma/schema.prisma` duplique le model
      `Meal` ; repercuter si oui.
- [x] `updateMealSchema` (`backend/src/schemas/kitchen.ts`) : ajouter
      `vegeCount`/`carneCount` (`z.number().int().min(0).optional()`).
- [x] `updateMeal` (`backend/src/services/meal.ts`) : ajouter les deux
      champs a `touchesManagerOnly` (memes droits que `maxAssistants`) et a
      la data d'update Prisma.
- [x] `getKitchenView`/`computeRosterLists` (`backend/src/services/kitchen.ts`) :
      exposer `eventParticipantsCount` (= `participations.length`, deja
      recupere) au niveau racine de la reponse GET /kitchen.
- [x] Projection des repas (`services/meal.ts`, `services/kitchen.ts`) :
      inclure `vegeCount`/`carneCount` dans `MealFiche` et `DashboardMeal`
      pour TOUS les roles avec acces (chef, manager, admin simple) - pas
      pour la vue equipier (board Info).
- [x] Tests integration : validation min(0), 403 si un chef tente de
      modifier ces champs, `eventParticipantsCount` correct, presence des
      champs dans les 3 projections concernees / absence dans le board
      equipier.
- [x] Mettre a jour `.claude/context/DB_MODELS.md` et `API_MAP.md`.

## Lot B - UI Gestion (auto-equilibrage + warning)

- [x] `MealFichesList.tsx` : nouvelle ligne "Repas" entre "Places" et
      "Equipiers" - deux `NumberStepper` (vege/carne), PATCH immediat par
      champ (meme pattern que la capacite equipiers existante).
- [x] Logique d'auto-equilibrage front : editer un champ met l'autre a
      `eventParticipantsCount - valeur`, clamp `[0, eventParticipantsCount]`.
- [x] Bandeau warning (badge + texte) si
      `vegeCount + carneCount !== eventParticipantsCount`, y compris a
      l'etat initial 0/0.
- [x] S'assurer que les repas orphelins (sans chef) affichent aussi cette
      ligne, editable par le responsable.
- [x] Tests frontend (testing-library) : auto-equilibrage bidirectionnel,
      warning affiche/masque selon la somme, clamp aux bornes.

## Lot C - Notifications

- [x] `updateMeal` (`services/meal.ts`) : comparer `vegeCount`/`carneCount`
      avant/apres l'update ; si different ET `meal.chefUserId !== null`,
      `createNotification` avec le contenu old -> new (accents francais
      corrects, texte visible utilisateur - exception ASCII-only du
      CLAUDE.md).
- [x] Verifier qu'aucune notif n'est envoyee si le repas est orphelin ou si
      les valeurs n'ont pas change (ex: PATCH avec les memes valeurs).
- [x] Reutiliser `kitchen:meal-changed` (deja emis) pour le temps reel, pas
      de nouvel event socket.
- [x] Tests integration : notif creee (bon destinataire/contenu) sur
      changement reel, absente sur repas orphelin ou valeurs inchangees ;
      premiere saisie depuis 0/0 compte comme une notif.

## Lot D - Vue chef "Mon repas"

- [x] `MealFicheEditor.tsx` : bloc lecture seule (2 stats vege/carne) pres
      du badge de capacite equipiers existant.
- [x] Note informative discrete si mismatch (non bloquante, non
      actionnable par le chef).
- [x] Tests frontend : rendu correct des valeurs, note affichee seulement
      en cas de mismatch.

## Lot E - Dashboard admin simple

- [x] `KitchenDashboard.tsx` : ajouter `vegeCount`/`carneCount` a
      l'interface `DashboardMeal` et deux badges lecture seule par carte
      repas (meme niveau d'info que Chef/Places).
- [x] Tests frontend : badges presents, aucune action/edition possible.

---

## E2E (a la fin, Lot B+C+D+E fusionnes dans le parcours existant)

- [x] Etendre `e2e/cuisine.spec.ts` (ou nouveau spec dedie) : responsable
      ajuste vege/carne sur un repas -> warning disparait -> chef voit la
      fiche a jour et recoit la notification avec le bon contenu.

## Doc a mettre a jour en fin de feature

- [x] `.claude/context/PROGRESS.md` : pointer vers cette roadmap tant que
      des lots restent ouverts, puis retirer une fois merge.
- [x] `.claude/context/TESTS.md` si de nouveaux fichiers de test sont crees.
- [ ] Changelog utilisateur (`docs/changelogs/`) a la fusion vers `master`,
      format standard (voir CLAUDE.md).
