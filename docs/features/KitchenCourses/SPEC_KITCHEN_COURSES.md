# Spec — Onglet Courses (liste de courses)

Module annonce en V2 dans `CookV1/SPEC_COOKING.md` (section "Hors perimetre") et
`CookV1/TodoLater.md` : donner a l'equipe courses une vue exploitable des
ingredients de tous les repas d'un event, et un export tableur.

La `note` par ligne d'ingredient (feature `KitchenRecipeNotes`) a ete concue pour
ce module : sa spec impose de **remonter les commentaires des lignes agregees
plutot que de les ignorer**. Cette contrainte est honoree en 4.3.

## 1. Perimetre

Ce module est **en lecture seule**. Il n'ajoute aucune ecriture, aucune migration,
aucun modele. Il lit `Meal` + `MealIngredient` d'un event et les restitue sous
trois formes + un export `.xlsx`.

Hors perimetre explicite :

- Aucune notion de "achete / pas achete" (pas de case a cocher, pas d'etat).
- Aucun budget, prix, ou magasin.
- Aucune edition d'ingredient depuis cet onglet (cela reste la fiche du chef).
- Les ustensiles (`MealUtensil`) ne sont pas repris.
- Les allergies (`EventKitchen.allergiesNotes`) ne sont pas reprises : elles
  restent chef/responsable cuisine.

## 2. Droits

### 2.1 Nouvelle preference

Une 5e cle admin dans la liste blanche (`backend/src/schemas/preference.ts`) :

| Cle             | Libelle UI        | Defaut | Modifiable par |
| --------------- | ----------------- | ------ | -------------- |
| `admin.courses` | "Gestion courses" | false  | ADMIN          |

Meme mecanique opt-in que `admin.events` / `admin.kitchen` : cle absente = false,
le backend reste protege independamment de ce que le front affiche. Elle rejoint
`ADMIN_RIGHT_ROWS` dans le profil, donc le bouton maitre "Tout activer" la couvre
comme les autres droits admin (les cles `beta.*` restent hors du bouton maitre).

### 2.2 Qui voit l'onglet Courses

| Profil                                       | Onglet Courses | Voit la case a cocher |
| -------------------------------------------- | -------------- | --------------------- |
| USER classique                               | non            | non                   |
| USER membre de l'equipe courses de l'event   | **oui**        | non                   |
| ADMIN sans `admin.courses`                   | non            | oui                   |
| ADMIN avec `admin.courses`                   | **oui**        | oui                   |
| ADMIN responsable cuisine (`admin.kitchen`)  | non            | oui                   |
| Chef cuisine (non admin, non membre courses) | non            | non                   |

Regle unique, sans exception : **`admin.courses` OU appartenance a
`KitchenCoursesMember` de cet event**. Un responsable cuisine voit deja tous les
ingredients dans l'onglet Cuisine ; s'il veut la vue courses, il coche la case.
Aucune derivation depuis `admin.kitchen`.

### 2.3 Garde backend

Nouveau middleware `requireCoursesAccess` (`backend/src/middleware/auth.ts`),
monte **apres** `requireEventParticipant` (qui laisse deja passer un ADMIN non
participant) :

```
requireCoursesAccess(req) =
     (user.role === "ADMIN" && preference["admin.courses"] === true)
  || KitchenCoursesMember existe pour (eventKitchen de :eventId, user)
```

Sinon `403` code `COURSES_ACCESS_REQUIRED`.

Note : le membre de l'equipe courses gagne ici l'acces aux ingredients, qui lui
etait refuse dans `GET /kitchen` (`isFullReader = manager || chef`). C'est
volontaire et circonscrit a ce nouvel endpoint ; **`GET /kitchen` n'est pas
elargi**, pour ne pas exposer aussi les allergies a l'equipe courses.

## 3. Donnees

Aucune migration. Source :

- `Meal` de l'`EventKitchen` de l'event, tries par `startDateTime` croissant.
- `MealIngredient` de chaque repas : `name`, `quantity` (Decimal 10,3), `unit`,
  `note`.

Regles de contenu :

- **Un repas sans ingredient apparait quand meme** (vue 1 et export : une ligne
  avec les colonnes ingredient vides).
- Un repas **orphelin** (sans chef) apparait comme les autres. Le chef n'est pas
  affiche : il n'a pas d'utilite en courses.
- Le nom affiche est `Meal.name`, complete d'un libelle de creneau
  (`Dejeuner du samedi`) : deux repas peuvent porter le meme nom personnalise, le
  creneau les distingue. Le payload transporte `service` + `startDateTime` et le
  libelle est produit par le helper `slotLabel()` deja present cote front ; le
  backend n'en fabrique un (`slotName()` de `kitchenPlanning`) que pour la colonne
  "Creneau" du fichier Excel.
- `quantity` est serialise en Decimal par Prisma : conversion en `number` cote
  service avant tout calcul.
- **Ordre des ingredients** : `MealIngredient` n'a pas de colonne de position, et
  les lignes sont supprimees/recreees en bloc a chaque PATCH. La vue 1 se contente
  donc de l'ordre naturel de la table, exactement comme `GET /kitchen` et la fiche
  du chef. En pratique c'est l'ordre de saisie, et surtout c'est le **meme** ordre
  que celui que le chef voit dans sa recette. Garantir formellement cet ordre
  demanderait une migration (`position Int`), hors perimetre.

## 4. Les trois vues

Le calcul des trois vues est fait **cote backend**, dans un service unique
(`services/shoppingList.ts`), et renvoye tel quel par le GET. L'export
`.xlsx` consomme exactement les memes structures. Objectif : il est impossible
que l'ecran et le fichier divergent, et l'agregation se teste en unitaire pur.

Le volume est negligeable (un event = ~6 repas x ~15 ingredients).

### 4.1 Vue 1 — par repas

Groupes = repas dans l'ordre chronologique. Sous chaque repas, ses ingredients
**dans l'ordre de saisie du chef** (ordre de la recette, pas alphabetique : le
chef a range sa liste, on ne la reorganise pas).

```
Diner du vendredi
  farine .............. 500 g
  miel ................ 250 g   (liquide, de preference agrume ou acacia)
  sel ................. 2 cac

Dejeuner du samedi
  (aucun ingredient)
```

### 4.2 Vue 2 — a plat, alphabetique

Toutes les lignes de tous les repas, **sans regroupement**, triees par nom
d'ingredient. Chaque ligne porte le repas d'origine.

Tri : `localeCompare("fr", { sensitivity: "base" })` — insensible a la casse et
aux accents, pour que "Echalote" et "echalote" se suivent au bon endroit.
Egalite de nom : depart chronologique du repas comme second critere, pour un
ordre stable.

```
farine ........ 500 g ..... Diner du vendredi
farine ........ 1 kg ...... Dejeuner du samedi
miel .......... 250 g ..... Diner du vendredi   (liquide, de preference ...)
miel .......... 300 g ..... Dejeuner du samedi  (si 300 g n'est pas plus cher ...)
```

### 4.3 Vue 3 — agregee

Comme la vue 2, mais les lignes de **meme nom et meme dimension d'unite** sont
fusionnees et leurs quantites sommees.

**Cle de regroupement** : `nom normalise` + `dimension`.

- Nom normalise = `trim().toLowerCase()` avec accents conserves. Le libelle
  affiche est la premiere graphie rencontree dans l'ordre chronologique.
  Regroupement sur le nom (et non `productId`) : c'est la regle demandee, et elle
  reste juste si un `Product` a ete supprime (`productId` passe a `null`).

**Dimensions et conversion** :

| Dimension        | Unites    | Unite canonique | Facteurs            |
| ---------------- | --------- | --------------- | ------------------- |
| Masse            | G, KG     | g               | G=1, KG=1000        |
| Volume           | ML, CL, L | ml              | ML=1, CL=10, L=1000 |
| Cuillere a soupe | CAS       | cas             | (aucune conversion) |
| Cuillere a cafe  | CAC       | cac             | (aucune conversion) |
| Piece            | PIECE     | piece           | (aucune conversion) |

CAS, CAC et PIECE sont chacun leur propre dimension : ils ne se convertissent en
rien (une cuillere a soupe de farine et une de miel n'ont pas la meme masse) et
produisent donc leur propre ligne. Consequence assumee : `sel 2 cac` et
`sel 10 g` restent deux lignes.

**Unite d'affichage du total** :

- Masse : `< 1000 g` -> g ; `>= 1000 g` -> kg.
- Volume : `< 1000 ml` -> ml ; `>= 1000 ml` -> L.
- Autres : leur propre unite.

Arrondi a 3 decimales (precision de la colonne `Decimal(10,3)`), zeros de fin
supprimes : `1.5 kg`, pas `1.500 kg`.

> Ecart assume vs le preview de validation : celui-ci montrait `250 ml + 300 ml`
> rendu en `55 cl`. La regle retenue ci-dessus rend `550 ml`. Le `cl` reste une
> unite de **saisie** mais n'est jamais une unite de **sortie** — sinon il faut
> un 3e seuil pour un gain de lisibilite discutable. A dire si tu preferes le cl.

**Commentaires et repas d'origine** (exigence de `KitchenRecipeNotes`) : la ligne
agregee conserve

- la liste des repas contributeurs, dans l'ordre chronologique ;
- chaque commentaire non vide, **prefixe du repas dont il vient**.

```
miel .......... 550 g
  Repas : Diner du vendredi, Dejeuner du samedi
  Diner du vendredi : liquide, de preference agrume (citronnier) ou acacia
  Dejeuner du samedi : si 300 g n'est pas beaucoup plus cher, prenez-en 300
```

Un repas sans ingredient ne produit aucune ligne dans les vues 2 et 3 (il n'a
rien a acheter) ; il n'apparait que dans la vue 1.

## 5. UI

### 5.1 Emplacement

Nouvel onglet **"Courses"**, dernier de la barre d'onglets de
`EventDetailPage`, **apres "Cuisine"** :

`Infos | Planning | Jeux de societe | Participants | Cuisine | Courses`

Valeur d'URL `?tab=courses` (ajoutee a `VALID_TABS`), deep-linkable comme les
autres. Un utilisateur qui n'a pas le droit et force `?tab=courses` retombe sur
l'onglet Infos, et l'API lui repondrait 403 de toute facon.

### 5.2 Selecteur de vue

Meme composant visuel que le toggle liste/calendrier du Planning : un groupe de
boutons carres `btn-xs` dans un conteneur `rounded-lg border border-base-300`,
avec `aria-label` + `title` sur chaque bouton. Trois positions :

| Vue | Icone        | Libelle (title)              |
| --- | ------------ | ---------------------------- |
| 1   | liste        | "Par repas"                  |
| 2   | tri A-Z      | "Tous les ingredients (A-Z)" |
| 3   | fusion/somme | "Ingredients regroupes"      |

Preference memorisee en `localStorage` sous `courses_view_preference`, meme
pattern (et meme tolerance a l'echec) que `planning_view_preference`.

### 5.3 Rendu

Desktop : tableau. Mobile : cartes empilees, comme `KitchenBoard` — jamais un
tableau a scroll horizontal.

Colonnes desktop par vue :

| Vue | Colonnes                                                       |
| --- | -------------------------------------------------------------- |
| 1   | Ingredient / Quantite / Unite / Commentaire (par groupe repas) |
| 2   | Ingredient / Quantite / Unite / Commentaire / Repas            |
| 3   | Ingredient / Quantite / Unite / Repas / Commentaires           |

Le commentaire s'affiche en italique attenue et **n'est jamais tronque**
(coherent avec la lecture en modale details, cf `KitchenRecipeNotes`).

Etat vide (`EmptyState`) si l'event n'a aucun repas : "Aucun repas planifie pour
le moment."

### 5.4 Export

Un bouton "Exporter en Excel" en tete de l'onglet, a cote du selecteur de vue.
Il exporte **la vue actuellement affichee** (le libelle le rappelle via `title`).
Pendant la generation, le bouton passe en etat `loading` et se desactive.

### 5.5 Temps reel

L'onglet se rafraichit via `useEventSocket` sur `kitchen:meal-changed`,
`kitchen:planning-generated` et `kitchen:config-updated` — une modification de
recette par un chef doit se voir sans rechargement. Pas de nouvel evenement
socket cote backend.

## 6. API

Prefixe existant `/api/events/:eventId/kitchen`.

| Method | Path               | Auth                                                         | Description                        |
| ------ | ------------------ | ------------------------------------------------------------ | ---------------------------------- |
| GET    | `/shopping`        | requireAuth + requireEventParticipant + requireCoursesAccess | Les trois vues precalculees        |
| GET    | `/shopping/export` | idem                                                         | Fichier `.xlsx` de la vue demandee |

### 6.1 `GET /shopping`

```jsonc
{
  "data": {
    "byMeal": [
      {
        "mealId": "...",
        "mealName": "Dîner du vendredi",
        "service": "DINNER",
        "startDateTime": "2026-08-14T16:30:00.000Z",
        "ingredients": [{ "name": "farine", "quantity": 500, "unit": "G", "note": null }],
      },
    ],
    "flat": [
      {
        "name": "farine",
        "quantity": 500,
        "unit": "G",
        "note": null,
        "mealId": "...",
        "mealName": "Dîner du vendredi",
      },
    ],
    "aggregated": [
      {
        "name": "miel",
        "quantity": 550,
        "unit": "G",
        "mealNames": ["Dîner du vendredi", "Déjeuner du samedi"],
        "notes": [{ "mealName": "Dîner du vendredi", "note": "liquide, ..." }],
      },
    ],
  },
}
```

`unit` reste la valeur d'enum (`G`, `KG`, ...) : le libelle francais est produit
par `unitLabel()` cote front, comme partout ailleurs.

### 6.2 `GET /shopping/export?view=`

- `view` ∈ `by-meal` | `flat` | `aggregated`. Valeur absente ou inconnue : `400`
  code `INVALID_EXPORT_VIEW`.
- Reponse : `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  `Content-Disposition: attachment; filename="courses-<slug-event>-<vue>.xlsx"`
  (nom d'event translittere en ASCII pour l'entete HTTP, avec `filename*=UTF-8''`
  en complement pour garder les accents dans les navigateurs modernes).
- Une seule feuille, nommee selon la vue.
- **Un ingredient par ligne**, en-tetes en gras et figes.
- `Quantite` est une **cellule numerique** (sommable dans Excel), pas du texte —
  d'ou le choix du vrai `.xlsx` plutot que du CSV.
- Vue 1 : un repas sans ingredient produit une ligne avec le repas renseigne et
  les colonnes ingredient vides.
- Vue 3 : `Repas` = noms joints par `, ` ; `Commentaires` = une ligne
  `"<repas> : <note>"` par commentaire, separees par des sauts de ligne dans la
  cellule (retour a la ligne active sur la colonne).

Genere avec `exceljs` (nouvelle dependance backend, MIT).

Cote frontend : `fetch` avec `credentials: "include"`, lecture en `Blob`,
`URL.createObjectURL` + ancre `download`, puis `revokeObjectURL`. Ce chemin
fonctionne en dev (backend sur un autre port) comme en prod, contrairement a une
navigation directe. `helpers` d'`api.ts` non reutilisables tels quels (ils
forcent `res.json()`) : un helper `downloadFile()` dedie est ajoute a
`config/api.ts`.

## 7. Codes d'erreur

| Code                      | Statut | Quand                                        |
| ------------------------- | ------ | -------------------------------------------- |
| `COURSES_ACCESS_REQUIRED` | 403    | Ni `admin.courses`, ni membre equipe courses |
| `INVALID_EXPORT_VIEW`     | 400    | `?view=` absent ou inconnu                   |

Reutilises : `EVENT_NOT_FOUND`, `NOT_EVENT_PARTICIPANT`.

Mapping francais a ajouter dans `frontend/src/config/apiErrors.ts`.

## 8. Points de vigilance

1. **Ne pas elargir `GET /kitchen`.** L'acces ingredients de l'equipe courses
   passe uniquement par `/shopping`, sinon les allergies fuitent avec.
2. **Decimal.** `quantity` arrive en `string` ; toute somme faite avant
   conversion en `number` produirait une concatenation silencieuse.
3. **Aucun repas / aucun ingredient.** Les trois vues doivent renvoyer des
   tableaux vides, jamais `null`, et l'export doit produire un fichier valide
   avec ses seuls en-tetes.
4. **Accents.** Les libelles de colonnes et les noms de repas sont du texte
   visible : accents francais corrects, dans le fichier Excel comme a l'ecran.
5. **`ProfilePage.test.tsx`** contient un objet de preferences en dur : il casse
   des l'ajout de la cle si on l'oublie.
