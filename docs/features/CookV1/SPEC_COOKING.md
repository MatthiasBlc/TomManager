# SPEC - Module Cuisine (CookV1)

Outil de gestion de l'organisation des repas, scope par-evenement, integre a
l'application existante (tables de jeu / plannings / participants Discord).

Statut : specification gelee (V1). Notes brutes d'origine : `ideaList.md`.

---

## 1. Roles et pouvoirs

| Role                | Definition                                                       | Pouvoirs cuisine                                                |
| ------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Responsable cuisine | ADMIN ayant active la preference `admin.kitchen` (opt-in profil) | Lecture + ecriture sur TOUTES les parties cuisine de tout event |
| Admin (autre)       | ADMIN sans `admin.kitchen`                                       | Lecture seule des parties cuisine                               |
| Chef                | Membre du roster chef de l'event (voir 2)                        | Ecriture de SON repas ; lecture des autres fiches               |
| Equipier            | Participant de l'event, ni chef ni membre courses                | Lecture du planning (si active) ; s'inscrire / se deplacer      |

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
| -------------- | ---------- | --------------------------------------- | ------ |
| id             | String     | UUID PK                                 |
| eventKitchenId | String     | FK -> EventKitchen.id, onDelete Cascade |
| userId         | String     | FK -> User.id                           |
| source         | ChefSource | ROLE                                    | MANUAL |

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

| Champ                 | Type        | Notes                                                |
| --------------------- | ----------- | ---------------------------------------------------- | --------------------------- |
| id                    | String      | UUID PK                                              |
| eventKitchenId        | String      | FK -> EventKitchen.id, onDelete Cascade              |
| chefUserId            | String?     | FK -> User.id (proprietaire) ; null = repas orphelin |
| name                  | String      | Intitule du repas / recette (1-150, texte visible)   |
| service               | MealService | LUNCH                                                | DINNER (midi / soir), label |
| startDateTime         | DateTime    | >= event.startDateTime, < endDateTime                |
| endDateTime           | DateTime    | <= event.endDateTime                                 |
| maxAssistants         | Int         | default 0 (0 tant que le planning n'est pas genere)  |
| createdAt / updatedAt | DateTime    |                                                      |

Unique : (eventKitchenId, chefUserId) -> 1 chef = 1 repas ; les NULL (orphelins) etant
distincts sous PostgreSQL, plusieurs repas orphelins peuvent coexister.
Index : (eventKitchenId, startDateTime)

### MealIngredient

| Champ     | Type    | Notes                                                                                              |
| --------- | ------- | -------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ----- |
| id        | String  | UUID PK                                                                                            |
| mealId    | String  | FK -> Meal.id, onDelete Cascade                                                                    |
| productId | String? | FK -> Product.id (find-or-create a l'ajout : effectivement toujours renseigne ; nullable defensif) |
| name      | String  | Nom denormalise (cache d'affichage du produit)                                                     |
| quantity  | Decimal | Quantite (Decimal, pas Float : sommes exactes V2)                                                  |
| unit      | Unit    | G                                                                                                  | KG  | ML  | CL  | L   | CAS | CAC | PIECE |

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

| Vue                        | Equipier                  | Chef                                                              | Admin simple                                 | Responsable                         |
| -------------------------- | ------------------------- | ----------------------------------------------------------------- | -------------------------------------------- | ----------------------------------- |
| Onglet Info - board repas  | oui si active             | oui                                                               | oui si participant + active                  | oui                                 |
| S'inscrire / se deplacer   | oui (ni chef, ni courses) | non                                                               | non                                          | non                                 |
| Onglet Cuisine - dashboard | non                       | non                                                               | oui (compteurs + liste repas, lecture seule) | non                                 |
| Onglet Cuisine - fiches    | non                       | RW **sa fiche uniquement** (jamais les autres, Evolutions.md 1/6) | non                                          | oui (RW toutes, Gestion uniquement) |
| Onglet Cuisine - gestion   | non                       | non                                                               | non                                          | oui (RW)                            |
| Allergies (contenu)        | non                       | oui (R)                                                           | non                                          | oui (RW)                            |

**Ecart au V1 gele (Evolutions.md, point 1/6)** : le chef n'a plus aucun acces, meme
en lecture, aux fiches des autres chefs, nulle part dans l'onglet Cuisine. La section
"Mon repas" est strictement bornee a sa propre fiche ; parcourir toutes les fiches
est une action reservee a la section Gestion (responsable uniquement).

**Admin simple** (role ADMIN, preference `admin.kitchen` non cochee, pas dans le roster
chef) : traite comme un equipier lambda partout (board Info conditionne a la
participation + au toggle, aucune fiche, aucune allergie/ingredient), **sauf** l'onglet
Cuisine qui reste accessible sous forme d'un dashboard en lecture seule (compteurs
chefs/equipe courses/sans-affectation + liste des repas sans detail sensible). Cocher
`admin.kitchen` bascule immediatement vers l'experience Responsable complete.

### Onglet Info (board repas)

- Rendu en **matrice jour (colonnes) x service (lignes Midi/Soir)** sur desktop
  (`<table>`), en cartes empilees par jour sur mobile (Evolutions.md point 3) ;
  construite depuis les repas reellement presents (pas un recalcul theorique de la
  grille attendue), pour absorber naturellement les creneaux manuels hors-grille.
  Cellule vide/grisee si aucun repas pour ce couple jour/service.
- Par repas : nom, chef ("Sans chef" si orphelin), **liste nominative des equipiers
  inscrits** (point 9) + places restantes (`maxAssistants` - inscrits).
- Actions equipier : s'inscrire (si place), se deplacer, se desinscrire — **jamais
  proposees a un chef ni a un membre de l'equipe courses** (point 4, exclusivite des
  roles), meme si le board leur est par ailleurs visible.
- Equipiers (et admin simple, cf ci-dessus) : le board n'apparait que si
  `equipierPlanningEnabled` ET participation a l'event. Chef/responsable le voient
  toujours.
- Banniere "Tu n'as pas encore choisi ton créneau de cuisine !" a cote du titre pour
  un equipier qui n'a ni chef, ni courses, ni repas (point 11).

### Onglet Cuisine

Visible si l'utilisateur est chef, admin (au moins simple), ou responsable (jamais un
equipier pur) ; le bouton de nav lui-meme est masque a un USER classique qui n'est
ni chef ni admin/responsable (point 10, en plus du garde-fou cote contenu).

Un utilisateur qui cumule responsable ET chef (roster) voit une sous-navigation locale
"Gestion" / "Mon repas" et **atterrit directement sur "Mon repas"** (point 5) ; un
utilisateur qui n'a qu'un seul role applicable (responsable seul, ou chef seul) ne voit
pas de sous-menu, juste la section correspondante.

Section Mon repas (chef uniquement ; jamais les fiches des autres, point 1/6) —
ordre d'affichage :

1. Rappel des allergies (lecture, toujours en haut).
2. Si pas encore de creneau : bloc "Choisir mon créneau" (liste deroulante groupee
   par jour, creneaux pris grises) -> claim.
3. Une fois un creneau reclame : sa fiche, en **edition inline avec sauvegarde a la
   volee par champ** (pas de bouton "Enregistrer") — nom, ingredients (autocomplete
   produit), ustensiles editables par le chef ; service/horaires/capacite en lecture
   seule (definis par la grille, manager only).
4. En dessous : le bloc d'echange de creneau ("Proposer un echange", demandes
   recues/envoyees, cf 5bis).

Section gestion (RW responsable uniquement ; masquee aux chefs et a l'admin simple) —
revue Admin Chef (Evolutions.md, tour "Admin Chef" points 1-6) :

- Definir / effacer `chefRoleId` (modale de confirmation si ecrase des chefs manuels).
- Liste des chefs (+ boutons ajouter/retirer si mode manuel uniquement).
- Equipe courses : assigner / retirer des participants (roster).
- Liste "sans affectation" (voir 11).
- Champ texte des allergies.
- Toggle `equipierPlanningEnabled`.
- Bloc "Planning" : compteur **equipiers repartis `allocated`/`poolTotal`** (point 4,
  `capacitySummary` sur `GET /kitchen`) puis, en toggle exclusif selon `meals.length` :
  - `meals.length === 0` -> bouton "Generer le planning" (warning + modale).
  - `meals.length > 0` -> bouton "Reinitialiser le planning" (danger + modale ;
    `POST /reset`, supprime tous les repas, garde les rosters intacts) a la place.
    Plus de creation manuelle hors-grille (point 3, `POST /meals` et son schema retires) :
    tous les repas naissent desormais de `/generate`.
- **Liste des fiches repas** (`MealFichesList`, point 5) : une ligne par repas, creneau
  identifie mais **non editable/non supprimable** (pas de champ jour/debut/fin, pas de
  bouton supprimer), avec directement sur la ligne :
  - libre/pris + nom du chef, ou un selecteur de chef parmi le roster pas encore
    assigne (remplace l'ancienne carte separee "repas orphelins") ;
  - capacite `X/Y` avec un stepper borne par le pool restant (`X` = deja pris, ne
    peut pas descendre en dessous) ;
  - equipiers assignes (retrait individuel) + selecteur d'ajout parmi les
    "sans affectation" si des places restent (nouveaux `POST/DELETE
/meals/:mealId/assistants/:userId`, manager only).
    Le clic sur la ligne ouvre une **modale "details"** en lecture seule (nom du plat,
    ingredients, ustensiles) ; bouton "Modifier" -> edition locale -> "Valider" fait un
    seul PATCH groupe et ferme la modale (pas d'auto-save ici, contrairement a "Mon
    repas"). Invisible a l'admin simple.

Section dashboard (admin simple uniquement, lecture seule) :

- Compteurs : nombre de chefs, taille de l'equipe courses, nombre de participants sans
  affectation.
- Liste des repas (nom, service, horaires, chef, places restantes) — sans ingredients,
  ustensiles ni allergies.
- Aucun bouton d'action.

### Onglet Planning (existant)

- Rendu des creneaux cuisine a cote des tables de jeu (voir 6).

---

## 5. Generation du planning (matrice de creneaux)

Le bouton "Generer le planning" **construit la grille des repas** de l'event a partir de
ses dates, puis repartit les places d'equipiers. Les chefs ne creent plus librement leur
repas : ils **reclament** un creneau de la grille (cf 5bis) et en editent le contenu.

### Derivation des creneaux (`computeExpectedSlots`)

- Jours calendaires en **Europe/Paris** (`Intl`, DST-safe), independant du fuseau serveur.
- Premier jour : **diner** seul. Jours intermediaires : **dejeuner + diner**. Dernier
  jour : **aucun** repas.
- Cas limite (event sur un seul jour calendaire) : la regle "premier jour" l'emporte
  (diner unique) plutot qu'une grille vide.
- Heures murales par defaut : dejeuner **10h30-13h00**, diner **18h30-21h00**. Nom par
  defaut accentue ("Dejeuner du samedi", "Diner du vendredi").
- Exemple (vendredi soir -> mardi) : vendredi soir, samedi midi/soir, dimanche
  midi/soir, lundi midi/soir (le mardi n'a rien) = 7 creneaux.

### Repartition du pool (`computeMealCapacities`) — sur les nouveaux creneaux seulement

- Pool = participants event - chefs (roster) - membres courses.
- A chaque appel, on distingue les repas **existants** (deja en base) des creneaux
  **manquants** crees a cet appel. `poolRestant = max(0, pool - somme(maxAssistants des
existants))`, puis `base = floor(poolRestant / nbNouveaux)`, `reste = poolRestant %
nbNouveaux` ; les `reste` premiers nouveaux creneaux (tries par startDateTime)
  recoivent `base + 1`.
- Personne n'est affecte automatiquement (les creneaux sont orphelins jusqu'a
  reclamation ; le chef est "affecte" de fait a son creneau une fois reclame).

### Idempotence

- **Cle de correspondance** `(eventKitchenId, startDateTime, service)` : un creneau deja
  present n'est **jamais recree ni modifie** (chef, equipiers, capacite intacts). Un
  reclic n'ajoute que les creneaux manquants (ex. dates de l'event etendues).
- Pour garantir cette cle, les champs **structurants** d'un repas (`startDateTime`,
  `endDateTime`, `service`, `maxAssistants`, `chefUserId`) sont **reserves au manager**
  dans `updateMeal` ; le chef n'edite que `name`, `ingredients`, `utensils`.
- **Sur-occupation** : si l'occupation courante d'un creneau depasse sa capacite, elle
  est **signalee** (`overCapacity` dans la reponse) sans desinscription ni modification.
- Le manager peut aussi creer un repas **manuel hors-grille** (`POST /meals`,
  manager-only) et editer `maxAssistants` a tout moment.

Regle d'inscription (join) : refuse si `inscrits >= maxAssistants`.

---

## 5bis. Reclamation et echange de creneau (chefs)

- **Reclamation** (`POST /meals/:mealId/claim`) : un chef du roster choisit un creneau
  orphelin de la grille. Verrou de ligne (`SELECT ... FOR UPDATE`) : deux reclamations
  concurrentes sont serialisees (la 2e voit le creneau pris -> `MEAL_ALREADY_CLAIMED`).
  Un chef ne peut avoir qu'un repas (`CHEF_ALREADY_HAS_MEAL`). UI : liste deroulante
  groupee par jour, creneaux pris grises.
- **Echange** (`MealSwapRequest`, confirmation mutuelle) : un chef propose d'echanger son
  creneau avec celui d'un autre chef ; la cible accepte ou refuse. A l'acceptation, la
  **recette** (chef + nom + ingredients + ustensiles) suit dans l'echange ; les
  **equipiers** (MealAssistant), les horaires, le service et la capacite **restent
  attaches au creneau d'origine**. Transaction : verrous ordonnes, passage des
  `chefUserId` par `null` (contrainte unique `[eventKitchenId, chefUserId]`),
  reassignation des FK ingredients/ustensiles filtree par PK. Statuts PENDING / ACCEPTED
  / REJECTED / CANCELLED (jamais de suppression physique). Une seule demande PENDING par
  repas (`SWAP_ALREADY_PENDING`).

---

## 6. Integration au moteur de conflits

`backend/src/services/conflicts.ts` (`computeEventConflicts`) unifie deja "tables de jeu

- occupations cuisine" en un seul jeu d'intervalles occupes par personne. Les creneaux
  orphelins (sans chef) issus de la grille sont ignores (`if (meal.chefUserId)`), donc ils
  ne generent aucun faux conflit tant qu'ils ne sont pas reclames.

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
- **Reconciliation bidirectionnelle (guildMemberUpdate)** : le gain/la perte du role
  chef et le gain/la perte de la participation (role Discord lie a l'event) sont deux
  evenements independants qui peuvent arriver dans n'importe quel ordre. En plus du
  traitement du role qui vient de changer (`handleChefRoleAdded`/`handleChefRoleRemoved`),
  `guildMemberUpdate` reconcilie aussi l'autre sens :
  - gain de participation alors que le role chef Discord est deja detenu →
    `reconcileChefEligibility` materialise le `KitchenChef ROLE` immediatement (sinon il
    fallait attendre un redemarrage du bot, cf `startupSync`, pour que le chef apparaisse) ;
  - perte de participation alors qu'un `KitchenChef(source=ROLE)` existe →
    `reconcileChefOnParticipationLost` le retire (repas orpheline, 2.4) pour ne jamais
    laisser un chef `ROLE` non-participant (invariant ci-dessus). Les chefs `MANUAL` ne
    sont pas concernes (geres explicitement par le responsable).
  - `startupSync` reste la reconciliation de reference (boucle complete, deja
    bidirectionnelle par construction) ; ces deux fonctions ne font que combler l'ecart
    entre deux redemarrages.

---

## 8. Temps reel (sockets)

Coherent avec l'existant (`event:updated`, notifications par room). Emettre vers la room
de l'event a chaque changement cuisine, pour que le board Info et l'onglet Cuisine se
mettent a jour en direct :

- `kitchen:config-updated` (chefRoleId, toggle, allergies, courses, roster chef)
- `kitchen:meal-changed` (creation/edition/suppression/reclamation/echange de repas)
- `kitchen:assistant-changed` (inscription/desinscription/deplacement)
- `kitchen:planning-generated`
- `kitchen:swap-request-changed` (creation/acceptation/refus/annulation d'un echange)

Les changements impactant les conflits declenchent aussi le recalcul/rendu Planning.

---

## 9. API (nouveaux endpoints, prefixe `/api/events/:eventId/kitchen`)

| Method | Path                                | Auth                     | Description                                                                          |
| ------ | ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| GET    | `/`                                 | lecture cuisine          | Config + roster chef + courses + repas (+ `capacitySummary` pour le manager)         |
| PATCH  | `/`                                 | requireKitchenManager    | Config (chefRoleId, allergies, toggle)                                               |
| POST   | `/chefs`                            | requireKitchenManager    | Ajout chef manuel (mode manuel)                                                      |
| DELETE | `/chefs/:userId`                    | requireKitchenManager    | Retrait chef manuel (orpheline son repas)                                            |
| POST   | `/courses`                          | requireKitchenManager    | Ajout membre courses                                                                 |
| DELETE | `/courses/:userId`                  | requireKitchenManager    | Retrait membre courses                                                               |
| POST   | `/generate`                         | requireKitchenManager    | Genere la grille de repas + repartit le pool (idempotent)                            |
| POST   | `/reset`                            | requireKitchenManager    | Supprime tous les repas de l'event (rosters conserves) — fait reapparaitre "Generer" |
| PATCH  | `/meals/:mealId`                    | requireMealChefOrManager | Editer un repas (horaires/service/maxAssistants/chefUserId = manager only)           |
| DELETE | `/meals/:mealId`                    | requireMealChefOrManager | Supprimer un repas (chef sur son propre creneau ; non expose en Gestion)             |
| POST   | `/meals/:mealId/claim`              | chef du roster (self)    | Reclamer un creneau orphelin de la grille (verrou de ligne)                          |
| POST   | `/meals/:mealId/assistants`         | equipier (self)          | S'inscrire / se deplacer (transaction)                                               |
| DELETE | `/meals/:mealId/assistants/me`      | equipier (self)          | Se desinscrire                                                                       |
| POST   | `/meals/:mealId/assistants/:userId` | requireKitchenManager    | Assigner/deplacer un equipier tiers sur un creneau (memes regles que self)           |
| DELETE | `/meals/:mealId/assistants/:userId` | requireKitchenManager    | Retirer un equipier tiers d'un creneau                                               |
| GET    | `/swaps`                            | chef/manager (self)      | Demandes d'echange PENDING visibles par l'appelant                                   |
| POST   | `/swaps`                            | chef proprietaire (self) | Proposer un echange (`{ targetMealId }`)                                             |
| POST   | `/swaps/:swapRequestId/accept`      | chef cible (self)        | Accepter (swap recette+chef, equipiers/horaires inchanges)                           |
| POST   | `/swaps/:swapRequestId/reject`      | chef cible (self)        | Refuser                                                                              |
| POST   | `/swaps/:swapRequestId/cancel`      | chef demandeur (self)    | Annuler sa propre demande                                                            |

**Creation manuelle hors-grille retiree** : `POST /meals` (creneau orphelin
`{date, service}`) n'existe plus — tous les repas naissent desormais de `/generate`.

**GET / est modele par role** (securite — les allergies sont sensibles, cf 4) :

- Equipier : board uniquement (nom du repas, chef, service, horaires, capacite,
  liste des inscrits). AUCUNE allergie, AUCUN ingredient/ustensile, aucune donnee de
  gestion (roster, courses, sans-affectation).
- Chef : board + fiches completes (allergies, ingredients, ustensiles) ; pas la gestion.
- Admin simple (ADMIN sans `admin.kitchen`, pas dans le roster chef) : meme niveau que
  l'equipier (board conditionne a la participation + au toggle, aucune fiche/allergie),
  plus un bloc `dashboard` (compteurs `chefsCount`/`coursesCount`/`unassignedCount`,
  jamais de liste nominative) toujours present et une liste `meals` (forme "board",
  sans ingredients/ustensiles) renvoyee independamment du toggle pour alimenter le
  dashboard de l'onglet Cuisine.
- Responsable : tout en lecture/ecriture.
- La reponse inclut `currentUserKitchenRole` (manager | chef | equipier | none) —
  calcule par priorite manager > chef > equipier > none, donc un responsable qui est
  aussi chef recoit `"manager"` — et un champ **independant** `isChef` (booleen, roster
  brut) pour que le front puisse quand meme distinguer ce cumul et afficher les deux
  interfaces (sous-menu "Gestion"/"Mon repas", cf 4). Le front gate les onglets/actions
  sur ces champs ; le backend reste l'autorite (middlewares 12).
- Si aucun `EventKitchen` n'existe encore : renvoyer un etat par defaut (pas de 404) —
  config vide, rosters vides, pas de repas. La 1re ecriture (PATCH /) cree la ligne.

Produits : reutiliser un endpoint autocomplete calque sur `/api/tags?q=`
(GET `/api/kitchen/products?q=`, find-or-create a l'ajout d'un ingredient).

Format d'erreur et codes stables : convention existante (`createError` + `code`,
mappe en francais dans `frontend/src/config/apiErrors.ts`). Codes proposes :
`MEAL_FULL`, `ALREADY_CHEF`, `NOT_IN_CHEF_ROSTER`, `ROLE_EXCLUSIVITY`,
`MEAL_ALREADY_EXISTS` (cible de creation/reassignation a deja un repas).
Reclamation/echange : `MEAL_ALREADY_CLAIMED`, `CHEF_ALREADY_HAS_MEAL`,
`NOT_A_CHEF_WITH_MEAL`, `TARGET_MEAL_ORPHAN`, `SWAP_ALREADY_PENDING`, `SWAP_NOT_PENDING`,
`SWAP_STALE`, `SWAP_SAME_MEAL`, `SWAP_NOT_FOUND`.

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

Livre (Lot H). Reutilise le systeme de notifications existant (`Notification` model,
`createNotification`/`createBulkNotifications`, in-app uniquement, pas de canal Discord
DM). Pas de preference d'opt-in/out (aucun type de notification existant n'en a une).

| Type                               | Declencheur                                | Destinataire(s)                             |
| ----------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `KITCHEN_SWAP_REQUESTED`           | Un chef propose un echange a un autre chef  | Chef cible                                     |
| `KITCHEN_SWAP_ACCEPTED`            | La cible accepte l'echange                  | Chef demandeur                                 |
| `KITCHEN_SWAP_REJECTED`            | La cible refuse l'echange                   | Chef demandeur                                 |
| `KITCHEN_ASSISTANT_SWAP_REQUESTED` | Un equipier demande un echange sur un repas complet | Equipiers actuellement inscrits sur le repas cible |
| `KITCHEN_ASSISTANT_SWAP_ACCEPTED`  | Un equipier du repas cible accepte          | Equipier demandeur                             |
| `KITCHEN_CHEF_ADDED`               | Ajout manuel ou sync role Discord           | Nouveau chef                                   |
| `KITCHEN_CHEF_REMOVED`             | Retrait manuel ou sync role Discord (repas orphelin) | Ancien chef                            |
| `KITCHEN_MEAL_CLAIMED`             | Un chef reclame un creneau ayant deja des equipiers inscrits | Equipiers inscrits             |
| `KITCHEN_OVERCAPACITY`             | Sur-occupation detectee a la (re)generation du planning | Chef du repas concerne (si non orphelin) |

Annulation d'une demande d'echange (chef ou equipier) : pas de notification (le
demandeur est seul acteur, aucun mecanisme de "retraction" ailleurs dans l'app). Sync
continue du roster chef via le bot Discord (process separe, pas d'acces au socket
backend) : ecrit directement la ligne `Notification`, sans push temps reel (visible au
prochain fetch/reconnexion).

---

## 14. Hors scope V1 (prevu V2)

- Chaque participant saisit ses propres allergies (persistees inter-events), en
  remplacement du champ texte global du responsable.
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
- Generation : grille de creneaux depuis les dates (diner J1, midi+soir intermediaires,
  rien le dernier jour) ; floor + reste sur les nouveaux creneaux ; idempotente.
- Le chef reclame un creneau de la grille (pas de creation libre) ; echange de creneau
  entre chefs par confirmation mutuelle (recette suit, equipiers restent).
- Temps reel via sockets sur la room event. Notifications cuisine livrees (Lot H,
  section 13), en plus du temps reel socket (pas en remplacement).
- Unites : G, KG, ML, CL, L, CAS, CAC, PIECE.
- **(Evolutions.md)** Le chef ne voit plus jamais les fiches des autres chefs (ecart
  au V1 gele ci-dessus, section 4) : "Mon repas" = sa seule fiche, parcourir toutes
  les fiches est reserve a Gestion (responsable).
- **(Evolutions.md)** Toute edition de repas (chef ou responsable) est en ligne avec
  sauvegarde a la volee par champ, plus aucune modale d'edition. La creation
  manuelle hors-grille (responsable) reste une mini-modale minimale (jour + service)
  car l'entite n'existe pas avant creation ; elle ne produit qu'un **creneau
  orphelin**, au meme titre qu'un creneau de la grille generee (memes horaires
  murales par defaut), jamais un repas nomme/assigne directement.

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
  - exclusivite + contrainte participant. `startupSync` : reconciliation du roster ROLE.

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
