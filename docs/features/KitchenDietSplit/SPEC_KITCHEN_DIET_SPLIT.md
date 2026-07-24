# SPEC - Repartition vege / carne par repas (evolution CookV1)

Evolution du module cuisine (spec gelee : `docs/features/CookV1/SPEC_COOKING.md`).
Reprend le backlog point 9 de `CookV1/TodoLater.md` ("info sur les repas nb vege /
carne"). Proposition UI validee par l'utilisateur (artefact interactif, 4 vues :
Gestion / Mon repas / Dashboard admin / Notification).

Statut : specification geleee pour cette evolution, prete a implementer.
Branche : `feature/kitchen-diet-split` (depuis `Developement`).

---

## 1. Objectif

Pour chaque repas, le responsable cuisine saisit une repartition agregee
vege/carne (2 entiers) qui doit toujours sommer au nombre de participants de
l'evenement. Les chefs voient cette repartition sur leur fiche (pour cuisiner
en connaissance de cause) et sont notifies quand elle change. Les admins
simples la voient dans le dashboard cuisine (lecture seule).

Pas de choix individuel par participant en V1 : saisie agregee uniquement par
le responsable (meme logique que le champ allergies texte libre global,
`CookV1/SPEC_COOKING.md` section 14).

---

## 2. Decision structurante : cible du total

Le modele actuel ne trace aucune presence par repas (`Meal.maxAssistants` /
`MealAssistant` = equipe cuisine, pas convives). La cible retenue est donc le
**nombre total de participants confirmes de l'evenement**
(`prisma.eventParticipation.count({ where: { eventId } })`, meme requete que
`computeAvailablePool`, `backend/src/services/kitchen.ts:201-206`), identique
pour tous les repas du meme evenement. Ce n'est pas un decompte propre a
chaque repas.

Consequence : si l'admin baisse/monte le nombre de participants de
l'evenement (inscription/desistement), les valeurs deja saisies sur les repas
existants ne bougent pas automatiquement ; seul un warning apparait tant que
la somme ne colle plus.

---

## 3. Modele de donnees (Prisma) - migration additive

`backend/prisma/schema.prisma`, model `Meal` (ligne ~290) :

```prisma
model Meal {
  ...
  maxAssistants Int         @default(0)
  vegeCount     Int         @default(0)
  carneCount    Int         @default(0)
  ...
}
```

- Migration `CREATE ... ALTER TABLE "Meal" ADD COLUMN "vegeCount" INTEGER NOT
  NULL DEFAULT 0, ADD COLUMN "carneCount" INTEGER NOT NULL DEFAULT 0` :
  additive, aucune donnee existante cassee (defaut 0/0 pour toutes les lignes
  presentes, coherent avec la regle produit "par defaut 0-0").
- Process migration (rappel projet, prod avec vrais users) : creee dans le
  container = fichier root:root, `chown 1003:1003` avant commit ; relire le
  SQL genere ; jamais `prisma migrate` directement contre la prod.
- Miroir manuel dans `discord-bot/prisma/schema.prisma` si ce schema y
  duplique le model `Meal` (verifier a l'implementation, meme reflexe que les
  migrations CookV1 precedentes).

Pas de contrainte DB `vegeCount + carneCount = participants` : la coherence
n'est qu'un warning applicatif (front + reponse API), jamais bloquant en
ecriture (l'admin peut sauvegarder une somme fausse et corriger plus tard).

---

## 4. API

### GET `/api/events/:eventId/kitchen`

`backend/src/services/kitchen.ts`, `getKitchenView` / `computeRosterLists`
(ligne ~391-424) recuperent deja `participations` (toutes les
`EventParticipation` de l'event) pour construire `unassigned`. Exposer en plus
`participations.length` au niveau racine de la reponse :

```ts
eventParticipantsCount: number; // total participants confirmes de l'event
```

Chaque repas (`MealFiche`/`DashboardMeal`, deja mappes dans
`services/meal.ts` et `services/kitchen.ts`) gagne `vegeCount` et
`carneCount` dans sa projection - visibles par chef, manager ET admin simple
(contrairement aux ingredients/allergies, ce n'est pas une donnee sensible).
Le board equipier (vue equipier) ne les recoit PAS (perimetre confirme :
chef + admin uniquement).

### PATCH `/api/events/:eventId/kitchen/meals/:mealId`

`backend/src/schemas/kitchen.ts`, `updateMealSchema` (ligne 47-60) : ajouter

```ts
vegeCount: z.number().int().min(0).optional(),
carneCount: z.number().int().min(0).optional(),
```

`backend/src/services/meal.ts`, `updateMeal` (ligne ~152-236) : ajouter
`vegeCount`/`carneCount` a la liste des champs structurants reserves au
manager (`touchesManagerOnly`, ligne ~169-180), au meme titre que
`maxAssistants` - le chef ne les edite jamais, meme sur sa propre fiche
(coherent avec "c'est a l'admin, responsable cuisine, de faire ce
parametrage"). Reutilise le pattern existant : pas de nouvel endpoint.

Pas de validation croisee "somme = participants" cote backend : `min(0)`
suffit, le warning est un calcul d'affichage (front + `eventParticipantsCount`
retourne par l'API), jamais un 400.

---

## 5. Notifications

Nouveau type d'enum `backend/prisma/schema.prisma`,
`enum NotificationType` (apres `KITCHEN_OVERCAPACITY`, ligne ~228) :

```prisma
KITCHEN_DIET_SPLIT_UPDATED
```

Declenchement : dans `updateMeal` (`services/meal.ts`), quand
`vegeCount`/`carneCount` sont fournis ET different des valeurs stockees
avant l'update (comparaison avant/apres, y compris depuis la valeur par
defaut 0/0 - une premiere saisie compte comme une mise a jour). Uniquement
si `meal.chefUserId !== null` (repas orphelin = personne a notifier ; pas de
notif differee a la reassignation, coherent avec le silence deja documente
sur les transitions de roster en V1).

Destinataire : le chef du repas uniquement (pas les equipiers, pas le
responsable qui vient de faire la modif - meme regle que
`KITCHEN_OVERCAPACITY`).

Message (`createNotification`, `backend/src/services/notification.ts`) -
texte visible utilisateur donc avec accents francais corrects (regle
CLAUDE.md, exception au ASCII-only) :

```
title:   "Répartition végé/carné mise à jour"
message: `Ton repas "${meal.name}" passe de ${old.vege} végé / ${old.carne}
           carné à ${new.vege} végé / ${new.carne} carné.`
metadata: { eventId, mealId }
```

Temps reel : reutiliser l'event socket existant `kitchen:meal-changed` (deja
emis par `updateMeal` pour toute modification de repas) - pas de nouvel
event socket necessaire, seul le payload de notification est nouveau.

---

## 6. UI - 3 vues (mockup valide)

### 6.1 Gestion (responsable) - `frontend/src/components/kitchen/MealFichesList.tsx`

Nouvelle ligne "Repas" sur chaque carte, entre la ligne "Places" (equipiers,
ligne ~234-261) et la ligne "Equipiers" (ligne ~263-317) - meme pattern
visuel (`row-label` + contenu), pour ne pas la confondre avec la capacite
equipe cuisine qui reste juste au-dessus :

- Deux compteurs `NumberStepper` (reutilise `frontend/src/components/common/NumberStepper.tsx`,
  deja utilise pour `maxAssistants`) : Vege / Carne. Editer l'un recalcule
  l'autre = `eventParticipantsCount - valeur_editee` (auto-equilibrage cote
  front, pas de bouton "Enregistrer" - PATCH immediat comme le reste de la
  ligne "Places").
- Barre de proportion (vege/carne) sous les steppers, purement visuelle.
- Warning (badge + bandeau, ton "warning" DaisyUI) si
  `vegeCount + carneCount !== eventParticipantsCount`, y compris a l'etat
  initial 0/0 (target > 0).
- S'applique aussi aux repas orphelins (`chefUserId === null`) : le
  responsable peut deja preparer la repartition avant qu'un chef ne
  reclame le creneau, comme les autres champs structurants de la grille.

### 6.2 Mon repas (chef) - `frontend/src/components/kitchen/MealFicheEditor.tsx`

Bloc lecture seule ajoute pres du badge de capacite equipiers existant
(ligne ~113-115) : deux stats (vege / carne), non editables. Si mismatch
(somme != `eventParticipantsCount`), note informative discrete ("la
repartition doit etre mise a jour par le responsable cuisine, rien a faire
de ton cote") - jamais bloquante, jamais actionnable par le chef.

### 6.3 Dashboard admin simple - `frontend/src/components/kitchen/KitchenDashboard.tsx`

Ajout de `vegeCount`/`carneCount` a l'interface `DashboardMeal` (ligne
25-35) et affichage de deux badges (vege/carne) sur chaque carte repas
(ligne ~192-263), lecture seule, meme niveau d'info que Chef/Places -
jamais d'ingredients/ustensiles/allergies ici (regle deja en place).

### 6.4 Hors perimetre (confirme)

- Pas d'exposition sur le board Info equipier (`Onglet Info`).
- Pas de choix individuel par participant en base (V2 eventuelle, comme les
  allergies par personne - `CookV1/SPEC_COOKING.md` section 14).

---

## 7. Decisions verrouillees pour cette evolution

- Cible = participants totaux de l'evenement (section 2), pas un decompte
  par repas.
- Repas orphelins editables des la generation du planning (section 6.1).
- Visibilite stricte chef (sa fiche) + admin (dashboard), rien pour les
  equipiers.
- Notification au chef uniquement, y compris pour la toute premiere saisie
  (0/0 -> valeur reelle compte comme une mise a jour).
- Pas de bouton "repartir au meme ratio" en V1 : correction toujours
  manuelle par le responsable (peut etre propose en evolution ulterieure si
  le besoin se confirme a l'usage).
- Aucune validation bloquante cote API : la coherence somme = participants
  est un warning d'affichage uniquement.

---

## 8. Securite des donnees (PRODUCTION - vrais users)

- Migration 100% additive (`ALTER TABLE ADD COLUMN ... DEFAULT 0` +
  `ALTER TYPE ... ADD VALUE` pour l'enum notification) : aucune donnee
  existante alteree, aucun backfill necessaire.
- Verifier le SQL sur la base de dev (docker) avant tout deploiement ; ne
  jamais lancer `prisma migrate` directement contre la prod.
- `chown 1003:1003` sur le fichier de migration genere en container avant
  commit.

---

## 9. Tests requis (rien ne merge sans tests, seuils CI 50/50)

- **Backend integration** (`backend/src/__tests__/integration/meal.test.ts`
  ou `kitchen.test.ts`) : PATCH vegeCount/carneCount refuse a un chef
  (403, coherent avec `touchesManagerOnly`) ; accepte pour le manager ;
  `eventParticipantsCount` correct dans GET / ; notification creee (bon
  destinataire, bon contenu old->new) uniquement si chef non-null et valeurs
  changees ; pas de notif si repas orphelin ou si les valeurs n'ont pas
  change.
- **Frontend** (`frontend/src/__tests__/`) : auto-equilibrage des deux
  steppers (editer l'un recalcule l'autre) ; warning affiche/masque selon
  la somme ; rendu read-only chef/dashboard.
- **E2E** (`e2e/cuisine.spec.ts` ou nouveau spec dedie) : responsable ajuste
  la repartition d'un repas -> chef voit la fiche mise a jour + recoit la
  notification.
