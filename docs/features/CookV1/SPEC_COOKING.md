# SPEC - Module Cuisine (CookV1)

Outil de gestion de l'organisation des repas, scope par-evenement, integre a
l'application existante (tables de jeu / plannings / participants Discord).

Statut : specification gelee (V1). Notes brutes d'origine : `ideaList.md`.

---

## 1. Roles et pouvoirs

| Role                | Definition                                                                | Pouvoirs cuisine                                                    |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Responsable cuisine | ADMIN ayant active la preference `admin.kitchen` (opt-in profil)          | Lecture + ecriture sur TOUTES les parties cuisine de tout event    |
| Admin (autre)       | ADMIN sans `admin.kitchen`                                                 | Lecture seule des parties cuisine                                  |
| Chef                | Membre du roster chef de l'event (voir 2)                                  | Ecriture de SON repas ; lecture des autres fiches                  |
| Equipier            | Participant de l'event, ni chef ni membre courses                          | Lecture du planning (si active) ; s'inscrire / se deplacer         |

Regles transverses :

- Le responsable n'a pas besoin d'etre participant de l'event (droit admin global).
- Un chef du roster sans repas reste un chef (le roster est independant des fiches).
- Invariant : un `Meal.chefUserId` non nul appartient TOUJOURS au roster (sortir du
  roster orpheline le repas, 2.4). "Proprietaire de repas" est donc un sous-ensemble
  du roster, jamais un chef "hors roster".
- Chefs et membres courses sont **necessairement des participants** de l'event.
- **Exclusivite des roles cuisine** : un participant a AU PLUS un role parmi
  {chef, membre courses, equipier}. Asymetrie de resolution : le role chef **preempte
  automatiquement** (retire courses/equipier, voir 2.4) ; entre courses et equipier,
  la 2e assignation est **bloquee** (pas d'auto-retrait, l'utilisateur doit d'abord
  quitter l'autre role).

---

## 2. Chefs

### 2.1 chefRoleId (par event)

Le `chefRoleId` (snowflake du role Discord chef) est stocke sur `EventKitchen`
(niveau event, comme `Event.discordRoleId`). Il est conserve par le bouton purge.
Deux modes de peuplement du roster, mais **le roster est TOUJOURS materialise** dans
`KitchenChef` (jamais calcule a la volee) — coherent avec `EventParticipation`.

### 2.2 Mode role (`chefRoleId` non nul)

- Le roster chef = participants de l'event portant `chefRoleId`, materialise en
  `KitchenChef` avec `source = ROLE`.
- **Sync initial** : renseigner un `chefRoleId` declenche immediatement une
  materialisation depuis les membres actuels de la guilde ayant ce role (meme
  mecanisme que la re-import participants du purge).
- **Sync continu** : le discord-bot maintient les lignes `source = ROLE` via
  `guildMemberUpdate` (ajout/retrait du role) et `startupSync`. Voir 8.
- En mode role, les boutons ajouter/retirer manuels sont masques.

### 2.3 Mode manuel (`chefRoleId` nul)

- Le responsable ajoute/retire les chefs a la main : lignes `KitchenChef`
  avec `source = MANUAL`. Boutons ajouter/retirer visibles uniquement dans ce mode.
- L'ajout manuel est **restreint aux participants de l'event** (un chef cuisine pour
  l'event ; garantit aussi la coherence du calcul du pool, 5).

### 2.4 Transitions et resolution d'exclusivite

- **Manuel -> role** (on renseigne un `chefRoleId` alors que des chefs `MANUAL`
  existent) : les lignes `MANUAL` sont **ecrasees** par le sync `ROLE`. Modale de
  confirmation obligatoire. Un chef `MANUAL` qui ne survit pas comme `ROLE` (il n'a pas
  le role Discord) et qui possede un repas voit ce repas **orpheline** (2.4).
- **Devenir chef** (via sync role ou ajout manuel) : si l'utilisateur etait membre
  courses ou equipier inscrit, ces lignes sont **retirees automatiquement** (le role
  chef gagne). En V1, silencieux (pas de notif, voir 12).
- **Sortir du roster** (retrait **manuel** OU perte du role Discord via sync) :
  la ligne `KitchenChef` est retiree. Si l'utilisateur possede un repas, ce repas
  devient **orphelin** (`chefUserId = null`) — la fiche (nom, ingredients, ustensiles,
  inscriptions equipiers) est **conservee intacte**. Le retrait manuel d'un chef avec
  repas est autorise, via modale de confirmation ("son repas deviendra orphelin, a
  reassigner").

### 2.5 Propriete d'un repas (suit le roster ; orphelin possible)

- Pour **creer** un repas : etre dans le roster `KitchenChef` ET ne pas deja avoir un
  repas sur cet event (unique). Le responsable peut aussi creer un repas au nom d'un
  chef du roster.
- La propriete suit le roster : sortir du roster orpheline le repas (2.4). Un repas
  orphelin (`chefUserId = null`) n'est editable que par le responsable jusqu'a
  reassignation.
- **Reassignation** (responsable) : affecter un repas orphelin a un chef du roster
  n'ayant pas deja de repas. Le nouveau chef decide ensuite de conserver la fiche du
  predecesseur ou de la refaire entierement.
- Un ancien chef qui reintegre le roster ne recupere PAS automatiquement son repas ;
  la reassignation reste un geste explicite du responsable.
- Pour la couverture des roles (11), seul un repas **non orphelin** rend son
  `chefUserId` "chef". Les repas orphelins sont listes au responsable (11).

---

## 3. Modele de donnees (Prisma)

### EventKitchen (1:1 avec Event, cree paresseusement a la 1re config)

| Champ                   | Type     | Notes                                                        |
| ----------------------- | -------- | ------------------------------------------------------------ |
| id                      | String   | UUID PK                                                      |
| eventId                 | String   | FK -> Event.id, UNIQUE, onDelete Cascade                     |
| chefRoleId              | String?  | Snowflake role Discord chef ; null = mode manuel             |
| allergiesNotes          | String?  | Texte libre global (max 5000), rempli par le responsable     |
| equipierPlanningEnabled | Boolean  | default false ; expose le board equipiers dans l'onglet Info |
| createdAt / updatedAt   | DateTime |                                                              |

### KitchenChef (roster chef materialise)

| Champ          | Type       | Notes                                   |
| -------------- | ---------- | --------------------------------------- |
| id             | String     | UUID PK                                 |
| eventKitchenId | String     | FK -> EventKitchen.id, onDelete Cascade |
| userId         | String     | FK -> User.id                           |
| source         | ChefSource | ROLE | MANUAL                           |

Unique : (eventKitchenId, userId)

### KitchenCoursesMember (equipe courses, assignee par le responsable)

| Champ          | Type   | Notes                                   |
| -------------- | ------ | --------------------------------------- |
| id             | String | UUID PK                                 |
| eventKitchenId | String | FK -> EventKitchen.id, onDelete Cascade |
| userId         | String | FK -> User.id                           |

Unique : (eventKitchenId, userId)
Taille equipe courses = compte de cette table (pas de champ entier).
Validation a l'ajout : la cible est un **participant de l'event**, et n'est ni chef
(roster/repas) ni equipier inscrit.

### Meal (fiche repas ; 1 chef = 1 repas)

| Champ                 | Type        | Notes                                                     |
| --------------------- | ----------- | --------------------------------------------------------- |
| id                    | String      | UUID PK                                                   |
| eventKitchenId        | String      | FK -> EventKitchen.id, onDelete Cascade                   |
| chefUserId            | String?     | FK -> User.id (proprietaire) ; null = repas orphelin       |
| name                  | String      | Intitule du repas / recette (1-150, texte visible)        |
| service               | MealService | LUNCH | DINNER (midi / soir), label                       |
| startDateTime         | DateTime    | >= event.startDateTime, < endDateTime                     |
| endDateTime           | DateTime    | <= event.endDateTime                                      |
| maxAssistants         | Int         | default 0 (0 tant que le planning n'est pas genere)       |
| createdAt / updatedAt | DateTime    |                                                           |

Unique : (eventKitchenId, chefUserId) -> 1 chef = 1 repas ; les NULL (orphelins) etant
distincts sous PostgreSQL, plusieurs repas orphelins peuvent coexister.
Index : (eventKitchenId, startDateTime)

### MealIngredient

| Champ     | Type    | Notes                                              |
| --------- | ------- | -------------------------------------------------- |
| id        | String  | UUID PK                                            |
| mealId    | String  | FK -> Meal.id, onDelete Cascade                    |
| productId | String? | FK -> Product.id (find-or-create a l'ajout : effectivement toujours renseigne ; nullable defensif) |
| name      | String  | Nom denormalise (cache d'affichage du produit)     |
| quantity  | Decimal | Quantite (Decimal, pas Float : sommes exactes V2)  |
| unit      | Unit    | G | KG | ML | CL | L | CAS | CAC | PIECE              |

### Product (catalogue, pattern identique aux Tag)

| Champ | Type   | Notes                       |
| ----- | ------ | --------------------------- |
| id    | String | UUID PK                     |
| name  | String | Unique, normalise lowercase |

### MealUtensil

| Champ  | Type   | Notes                           |
| ------ | ------ | ------------------------------- |
| id     | String | UUID PK                         |
| mealId | String | FK -> Meal.id, onDelete Cascade |
| name   | String | Ustensile specifique (1-100)    |

### MealAssistant (inscription equipier)

| Champ          | Type     | Notes                                             |
| -------------- | -------- | ------------------------------------------------- |
| id             | String   | UUID PK                                           |
| mealId         | String   | FK -> Meal.id, onDelete Cascade                   |
| eventKitchenId | String   | FK -> EventKitchen.id (denormalise pour l'unique) |
| userId         | String   | FK -> User.id                                     |
| createdAt      | DateTime |                                                   |

Unique : (mealId, userId) ET (eventKitchenId, userId)
Regle metier : un equipier est inscrit sur AU PLUS UN repas par event ; l'unique
(eventKitchenId, userId) l'empeche. "Se deplacer" = quitter + rejoindre (transaction).

### Enums

- `ChefSource` : ROLE | MANUAL
- `MealService` : LUNCH | DINNER
- `Unit` : G | KG | ML | CL | L | CAS | CAC | PIECE
  (masse: G/KG ; volume: ML/CL/L + CAS ~15mL / CAC ~5mL ; comptage: PIECE — la
  conversion V2 se fait au sein d'une meme dimension)

---

## 4. Vues UI et visibilite

### Matrice de visibilite

| Vue                         | Equipier          | Chef              | Admin simple | Responsable |
| --------------------------- | ----------------- | ----------------- | ------------ | ----------- |
| Onglet Info - board repas   | oui si active     | oui               | oui          | oui         |
| S'inscrire / se deplacer    | oui               | non               | non          | non         |
| Onglet Cuisine - fiches     | non               | oui (RW la sienne)| oui (R)      | oui (RW)    |
| Onglet Cuisine - gestion    | non               | non               | oui (R)      | oui (RW)    |
| Allergies (contenu)         | non               | oui (R)           | oui (R)      | oui (RW)    |

### Onglet Info (board repas)

- Tableau des repas : intitule + chef + service + plage horaire. Un repas orphelin
  s'affiche avec la mention "sans chef" (il reste inscriptible tant que capacite > 0).
- Par repas : equipiers inscrits + places restantes (`maxAssistants` - inscrits).
- Actions equipier : s'inscrire (si place), se deplacer, se desinscrire.
- Equipiers : le board n'apparait que si `equipierPlanningEnabled`. Chef/admin/
  responsable le voient toujours.

### Onglet Cuisine

Visible si l'utilisateur est chef, admin, ou responsable (jamais un equipier pur).

Section gestion (RW responsable, R admin simple ; masquee aux chefs) :

- Definir / effacer `chefRoleId` (modale de confirmation si ecrase des chefs manuels).
- Liste des chefs (+ boutons ajouter/retirer si mode manuel uniquement).
- Equipe courses : assigner / retirer des participants (roster).
- Liste "sans affectation" (voir 11).
- Repas orphelins (chef retire) : reassigner a un chef du roster sans repas.
- Champ texte des allergies.
- Toggle `equipierPlanningEnabled`.
- Bouton "Generer le planning" (warning + modale, destructif).

Section fiches repas (chef edite la sienne, lecture sur les autres) :

- Nom, service, heures debut/fin.
- Rappel des allergies (lecture).
- Ingredients (nom + quantite + unite, autocomplete produit).
- Ustensiles specifiques.

### Onglet Planning (existant)

- Rendu des creneaux cuisine a cote des tables de jeu (voir 6).

---

## 5. Generation du planning

- Prerequis : les repas (fiches) existent. `nbRepas` = nombre de repas de l'event.
- 1 repas = 1 bucket (capacite `maxAssistants`), pas de sous-creneaux.
- Pool = participants event - chefs (roster) - membres courses.
  (Un proprietaire de repas est toujours dans le roster, cf invariant 1.)
- Repartition equilibree :
  - `base = floor(pool / nbRepas)`, `reste = pool % nbRepas`.
  - Les `reste` premiers repas (tries par startDateTime) recoivent `base + 1`, les
    autres `base`.
  - Clamp : si `pool <= 0` ou `nbRepas = 0`, `maxAssistants = 0` partout (no-op si 0 repas).
- Personne n'est affecte automatiquement (le chef est "affecte" de fait a son repas).
- **Regeneration** : conserve les inscriptions existantes. Si une nouvelle capacite est
  inferieure a l'occupation courante, on **applique quand meme** la capacite (le repas
  peut etre temporairement en sur-occupation) et on avertit dans la modale. Aucune
  desinscription automatique. Bouton warning + modale (destructif au 2e usage).
- Le responsable peut editer `maxAssistants` par repas **a tout moment** (>= 0), que le
  planning ait ete genere ou non (la generation n'est qu'une aide au calcul initial).

Regle d'inscription (join) : refuse si `inscrits >= maxAssistants` (donc un repas en
sur-occupation apres regen n'accepte pas de nouveaux equipiers tant qu'il n'est pas
revenu sous la capacite).

---

## 6. Integration au moteur de conflits

`backend/src/services/gameTable.ts` (~ligne 219) calcule aujourd'hui les chevauchements
entre tables de jeu uniquement. Unifier "tables de jeu + occupations cuisine" en un seul
jeu d'intervalles occupes par personne, puis recalculer les conflits.

Occupations cuisine injectees :

- Chef : occupe sur [start, end] de SON repas.
- Equipier : occupe sur [start, end] du repas ou il est inscrit.

Surbrillance visible par : la personne concernee, le chef du repas en conflit, et le MJ
de la table en conflit (symetrie avec la regle GM/joueur existante). Le rendu des
creneaux cuisine s'ajoute a la vue Planning.

---

## 7. Bot Discord (chefs par role)

Reutilise l'infra existante (`discord-bot/src/handlers/guildMemberUpdate.ts`,
`services/startupSync.ts`, `services/syncParticipation.ts`).

- `guildMemberUpdate` : si un membre gagne/perd un role qui est un `chefRoleId` d'un
  `EventKitchen`, ajouter/retirer la ligne `KitchenChef` `source = ROLE`
  (avec resolution d'exclusivite 2.4 : retrait courses/equipier au gain).
- `startupSync` : reconcilier le roster `ROLE` de chaque `EventKitchen.chefRoleId`.
- Sync initial au `set` du `chefRoleId` : cote **backend**, reutiliser
  `fetchAllGuildMembers()` (`services/adminSync.ts`) + filtre sur `chefRoleId`, exactement
  comme `syncEventParticipantsFromDiscord`. Le backend appelle l'API Discord directement
  avec le token bot — PAS de RPC vers le process discord-bot. Seul le sync **continu**
  (guildMemberUpdate/startup) vit dans le discord-bot.
- Contrainte : un chef `ROLE` doit aussi etre participant de l'event ; un membre qui a
  le role chef mais ne participe pas a l'event n'est pas ajoute.

---

## 8. Temps reel (sockets)

Coherent avec l'existant (`event:updated`, notifications par room). Emettre vers la room
de l'event a chaque changement cuisine, pour que le board Info et l'onglet Cuisine se
mettent a jour en direct :

- `kitchen:config-updated` (chefRoleId, toggle, allergies, courses, roster chef)
- `kitchen:meal-changed` (creation/edition/suppression de repas)
- `kitchen:assistant-changed` (inscription/desinscription/deplacement)
- `kitchen:planning-generated`

Les changements impactant les conflits declenchent aussi le recalcul/rendu Planning.

---

## 9. API (nouveaux endpoints, prefixe `/api/events/:eventId/kitchen`)

| Method | Path                          | Auth                    | Description                                   |
| ------ | ----------------------------- | ----------------------- | --------------------------------------------- |
| GET    | `/`                           | lecture cuisine         | Config + roster chef + courses + repas        |
| PATCH  | `/`                           | requireKitchenManager   | Config (chefRoleId, allergies, toggle)        |
| POST   | `/chefs`                      | requireKitchenManager   | Ajout chef manuel (mode manuel)               |
| DELETE | `/chefs/:userId`              | requireKitchenManager   | Retrait chef manuel (orpheline son repas)     |
| POST   | `/courses`                    | requireKitchenManager   | Ajout membre courses                          |
| DELETE | `/courses/:userId`            | requireKitchenManager   | Retrait membre courses                        |
| POST   | `/generate`                   | requireKitchenManager   | Generation/regeneration du planning           |
| POST   | `/meals`                      | chef (self) / manager   | Creer un repas                                |
| PATCH  | `/meals/:mealId`              | requireMealChefOrManager| Editer un repas (+ maxAssistants et reassignation chefUserId pour manager) |
| DELETE | `/meals/:mealId`              | requireMealChefOrManager| Supprimer un repas                            |
| POST   | `/meals/:mealId/assistants`   | equipier (self)         | S'inscrire / se deplacer (transaction)        |
| DELETE | `/meals/:mealId/assistants/me`| equipier (self)         | Se desinscrire                                |

**GET / est modele par role** (securite — les allergies sont sensibles, cf 4) :

- Equipier : board uniquement (nom du repas, chef, service, horaires, capacite,
  liste des inscrits). AUCUNE allergie, AUCUN ingredient/ustensile, aucune donnee de
  gestion (roster, courses, sans-affectation).
- Chef : board + fiches completes (allergies, ingredients, ustensiles) ; pas la gestion.
- Admin simple : tout en lecture. Responsable : tout en lecture/ecriture.
- La reponse inclut `currentUserKitchenRole` (manager | chef | equipier | none) pour que
  le front gate les onglets/actions. Le backend reste l'autorite (middlewares 12).
- Si aucun `EventKitchen` n'existe encore : renvoyer un etat par defaut (pas de 404) —
  config vide, rosters vides, pas de repas. La 1re ecriture (PATCH /) cree la ligne.

Produits : reutiliser un endpoint autocomplete calque sur `/api/tags?q=`
(GET `/api/kitchen/products?q=`, find-or-create a l'ajout d'un ingredient).

Format d'erreur et codes stables : convention existante (`createError` + `code`,
mappe en francais dans `frontend/src/config/apiErrors.ts`). Codes proposes :
`MEAL_FULL`, `ALREADY_CHEF`, `NOT_IN_CHEF_ROSTER`, `ROLE_EXCLUSIVITY`,
`MEAL_ALREADY_EXISTS` (cible de creation/reassignation a deja un repas).

---

## 10. Purge d'event (extension du bouton existant)

Le purge conserve `Event.discordRoleId` et re-importe les participants. Extension :

- Conserver `EventKitchen` et son `chefRoleId` (mais pas le contenu ci-dessous).
- Purger : repas (Meal + ingredients/ustensiles/assistants en cascade), equipe courses
  (KitchenCoursesMember), et les chefs `source = MANUAL` uniquement.
- Les chefs `source = ROLE` se reconstituent via le re-import des participants +
  re-sync du `chefRoleId`.

---

## 11. Dashboard responsable : couverture des roles

Liste des participants **sans affectation** = participants de l'event qui ne sont ni
chef (roster), ni membre courses, ni equipier inscrit. Objectif : chacun a au moins un
role. Exclusivite des roles (2.4) => liste exacte. Assigner un role retire la personne
de la liste.

Le dashboard liste aussi les **repas orphelins** (chef retire, `chefUserId = null`) a
reassigner.

---

## 12. Permissions & middlewares (calques sur `middleware/auth.ts`)

- `requireKitchenManager` : ADMIN + preference `admin.kitchen`.
- `requireMealChefOrManager` : `meal.chefUserId === currentUser.id` OU manager.
- Lecture cuisine : tout ADMIN + chefs de l'event + (equipiers, board Info si active).
- Ajouter `admin.kitchen` a la liste blanche `schemas/preference.ts` (reservee ADMIN).
- Les mutations equipier verifient l'exclusivite (pas chef, pas courses) et la capacite.

---

## 13. Notifications

**Aucune notification cuisine en V1** (garde le scope serre). Les resolutions
automatiques d'exclusivite (2.4) et les sur-occupations post-regen sont donc
silencieuses. Notifications prevues en V2.

---

## 14. Hors scope V1 (prevu V2)

- Chaque participant saisit ses propres allergies (persistees inter-events), en
  remplacement du champ texte global du responsable.
- Notifications cuisine.
- Module courses : agregation des ingredients par `Product` avec conversion d'unites au
  sein d'une dimension, calcul des quantites totales, liste de courses.

Le modele (Product + Decimal + Unit par dimension) absorbe la V2 sans migration destructive.

---

## 15. Decisions verrouillees

- Roster chef materialise (`KitchenChef`, `source ROLE|MANUAL`), bot sync comme la participation.
- Propriete d'un repas suit le roster : sortir du roster orpheline le repas
  (`chefUserId` nullable, fiche conservee) ; le responsable reassigne a un chef libre.
- Roles cuisine mutuellement exclusifs ; le role chef prime lors des transitions.
- Equipe courses = roster (KitchenCoursesMember), taille = compte.
- Equipier = au plus un repas par event.
- Generation : floor + reste sur les premiers repas ; regen non destructive.
- Temps reel via sockets sur la room event. Pas de notifications en V1.
- Unites : G, KG, ML, CL, L, CAS, CAC, PIECE.

---

## 16. Tests (obligatoire — rien ne merge sans tests)

Aligne sur l'infra existante (`.claude/context/TESTS.md`). Chaque lot livre ses tests
dans le meme commit que le code. Seuils CI 50%/50% a maintenir.

### Backend (Vitest + Supertest, `backend/src/__tests__/`)

- **Unitaires** — logique de generation (`floor`/reste, clamps pool<=0, nbRepas=0,
  sur-occupation), resolution d'exclusivite, calcul du pool.
- **Integration** (`integration/kitchen.test.ts`) — chaque endpoint (9) avec sa matrice
  d'auth ; cas nominaux + erreurs (codes stables 9). A couvrir explicitement :
  - GET / **modele par role** : un equipier ne recoit NI allergies NI ingredients
    (test anti-fuite) ; `currentUserKitchenRole` correct par role ; defaut sans 404.
  - Exclusivite : chef preempte courses/equipier ; ajout courses/equipier bloque si
    autre role ; participants-only pour chef manuel et courses.
  - Orphelinage : retrait d'un chef avec repas -> `chefUserId=null`, fiche conservee ;
    reassignation ; unique 1 chef/repas (NULL distincts).
  - Capacite : join refuse si plein ; "se deplacer" transactionnel (rollback si dest pleine).
  - Purge : conserve chefRoleId, purge repas/courses/chefs MANUAL, garde ROLE.

### Discord-bot (Vitest, `discord-bot/src/__tests__/`)

- `guildMemberUpdate` chef : gain/perte de `chefRoleId` -> add/remove `KitchenChef ROLE`
  + exclusivite + contrainte participant. `startupSync` : reconciliation du roster ROLE.

### Frontend (Vitest + testing-library, `frontend/src/__tests__/`)

- Onglet Cuisine (gestion + fiches) : rendu selon la matrice de visibilite, modales de
  confirmation (ecrasement chefs, regeneration, suppression repas avec compte equipiers).
- Board Info : inscription / deplacement / desinscription, places restantes, repas
  "sans chef", masquage board equipier si `equipierPlanningEnabled` = false.
- Maj temps reel : reaction aux events `kitchen:*` (calque sur `useEventSocket`).

### Conflits (Lot F)

- Unitaires du calcul unifie : chevauchement table<->creneau cuisine, chef occupe par
  son repas + inscrit a une table, visibilite surbrillance (personne/chef/MJ).

### E2E (Playwright, `e2e/`, spec `cuisine`)

Parcours complet, seed via API + login cookie (comme les specs existantes) :
responsable configure -> chef cree un repas -> equipier s'inscrit -> conflit visible
dans le Planning -> purge. Login par injection de cookie (`loginAs`).

---

## 17. Securite des donnees (PRODUCTION - il y a des users reels)

Contrainte absolue : la migration ne doit RIEN casser sur les donnees existantes.

- **Migration 100% additive** : uniquement `CREATE TABLE` (EventKitchen, KitchenChef,
  KitchenCoursesMember, Meal, MealIngredient, Product, MealUtensil, MealAssistant) et
  `CREATE TYPE` (ChefSource, MealService, Unit). AUCUN `ALTER`/`DROP` sur une table ou
  colonne existante (User, Event, GameTable... intouchees).
- La cle de preference `admin.kitchen` est un ajout applicatif (liste blanche), pas un
  changement de schema ; cle absente = false (retro-compatible).
- Toutes les FK vers des tables existantes (User, Event) sont en `onDelete Cascade` cote
  tables cuisine uniquement : supprimer un event nettoie sa cuisine, jamais l'inverse.
- Aucune donnee cuisine n'existe avant la migration -> pas de backfill, pas de defaut a
  recalculer sur des lignes existantes.
- **Process migration** (rappel projet) : migration creee dans le container = fichier
  root:root ; faire `chown 1003:1003` avant commit. Relire le SQL genere avant d'appliquer.
- Verifier le SQL sur la base de dev (docker) avant tout deploiement ; ne jamais lancer
  `prisma migrate` directement contre la prod. Le deploiement prod applique les
  migrations versionnees, pas `migrate dev`.
- Les operations destructives cote app (purge, regeneration, ecrasement chefs manuels,
  retrait d'un chef avec repas, suppression repas) sont toutes derriere une modale de
  confirmation explicite. La suppression d'un repas avertit du nombre d'equipiers
  inscrits qui perdront leur place (cascade `MealAssistant`).
