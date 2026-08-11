# ROADMAP - Commentaire par ingredient + correctif des 429

Spec : `SPEC_KITCHEN_RECIPE_NOTES.md`. Branche de base : `Developement` ->
`feature/kitchen-recipe-notes`.

Deux sujets remontes ensemble depuis la prod sur la meme page. Livres dans un seul
lot : ils touchent les memes fichiers (`IngredientListInput`, `MealFicheEditor`,
`services/meal.ts`) et separer aurait fait deux fois le meme conflit.

**Rappel PROD** : migration 100% additive (`ADD COLUMN "note" TEXT`, nullable, aucun
defaut a backfiller) ; ownership du dossier de migration aligne sur ses voisins (le
`docker exec` le cree en root) ; relire le SQL ; jamais `prisma migrate` directement
contre la prod.

## Modele par lot

| Lot                       | Modele   | Effort |
| ------------------------- | -------- | ------ |
| A (commentaire, DB -> UI) | Sonnet 5 | ~1-2h  |
| B (correctif 429 + CSP)   | Opus 4.8 | ~2-3h  |

Lot B en Opus : diagnostic multi-couches (infra proxy, temps reel, debounce) ou la
cause principale n'etait pas dans le code applicatif.

---

## Lot A - Commentaire par ingredient

- [x] Migration additive `MealIngredient.note String?`
      (`20260811191135_meal_ingredient_note`), relue : `ADD COLUMN "note" TEXT` seul.
- [x] Repercuter le champ sur `discord-bot/prisma/schema.prisma` (schema duplique
      sur la meme base).
- [x] `ingredientSchema` : `note` optionnel/nullable, max 300.
- [x] `services/meal.ts` : `IngredientInput.note`, ecrit dans `createMany` avec
      normalisation blanc -> `null`.
- [x] `IngredientListInput` : champ `note` sur `IngredientRow`, bouton 💬 par ligne,
      zone de texte pleine largeur, affichage d'office si commentaire existant.
- [x] `MealFicheEditor` + `MealFicheDetailModal` : lecture/ecriture de `note` dans les
      deux chemins d'edition (auto-save et "Modifier"/"Valider").
- [x] Affichage lecture seule sous la ligne d'ingredient (italique atenue, non
      tronque).
- [x] Tests backend : persistance, normalisation blanc -> `null`, rejet > 300.
- [x] Tests frontend : champ masque par defaut, remontee de la saisie, reaffichage
      d'un commentaire existant.

## Lot B - Correctif des 429 + CSP

- [x] `TRUST_PROXY` lu par `config/env` (`num`, defaut 0) au lieu du `1` code en dur ;
      `2` en prod **et** preprod (Traefik + nginx). Cause principale : le quota etait
      partage par tous les utilisateurs au lieu d'etre par IP.
- [x] Plafonds releves : global 100 -> 300 req/min, ecritures 30 -> 120/min.
- [x] `useKitchenData` : coalescence des refetch (un timer par ressource, 30 ms) +
      nettoyage des timers au demontage.
- [x] `kitchen:meal-changed` ne declenche plus `refetchAll` (les listes d'echanges ont
      leur propre evenement).
- [x] Autocompletion produit : minimum 2 caracteres, debounce 200 -> 350 ms, garde
      anti-reponse-hors-ordre.
- [x] `useDebouncedSave` : filet de securite au demontage (prealable indispensable
      avant d'allonger le debounce).
- [x] Debounce des listes (ingredients/ustensiles) porte a 1200 ms.
- [x] CSP : script anti-flash de theme extrait dans `frontend/public/theme-init.js`
      (l'inline etait bloque en prod, donc inoperant depuis toujours).
- [x] Tests frontend : pas de recherche sous 2 caracteres, une seule requete pour un
      nom tape en continu.
- [x] Test manuel dedie ajoute (`docs/MANUAL_TESTING.md` 12.2) : verifier que deux
      appareils sur des connexions differentes ne partagent pas le compteur.

## Verifie avant livraison

- [x] `npx tsc --noEmit` backend + frontend
- [x] Suites completes : 434 tests backend, 458 frontend (dont les nouveaux)
- [x] Build frontend : `dist/theme-init.js` present, zero `<script>` inline restant
      dans `dist/index.html`
- [x] Prettier depuis la racine

## Reste a faire (hors perimetre de cette branche)

- Module courses : quand il arrivera, l'agregation par `Product` devra remonter les
  commentaires des lignes plutot que les perdre (une meme denree peut porter des
  commentaires differents selon les recettes). Cf `CookV1/SPEC_COOKING.md`.
- Verifier apres deploiement que les 429 ont disparu des logs prod, et que
  `TRUST_PROXY=2` correspond toujours a la chaine de proxys reelle.
