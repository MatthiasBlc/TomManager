# Spec — Commentaire par ingredient + correctif des 429 (retour prod)

Deux sujets remontes ensemble depuis la prod, sur la meme page (fiche recette d'un
repas) :

1. Un chef veut pouvoir preciser une ligne de sa liste d'ingredients.
2. La saisie de cette meme liste declenchait des rafales de `429 Too Many Requests`.

## 1. Commentaire par ingredient

### Besoin

La liste d'ingredients ne portait que `nom / quantite / unite`. Or un chef a
regulierement besoin de preciser une ligne a l'intention de l'equipe courses, sans
changer la quantite. Exemples reels :

- `miel 250 g` -> "liquide, de preference agrume (citronnier) ou acacia ; si 300 g
  n'est pas beaucoup plus cher, prenez-en 300"
- `huile de sesame 250 ml` -> "si on peut avoir 300 ml sans prendre une bouteille en
  plus c'est mieux, sinon 250 ml"

Ces precisions se ecrivaient jusque-la nulle part dans l'app (transmises a l'oral ou
sur un message a cote), donc perdues pour l'equipe courses.

### Modele

`MealIngredient.note String?` — commentaire libre, max 300 caracteres.

Porte par la **ligne de recette** et non par le `Product` du catalogue : la meme
denree peut demander une precision differente d'une recette a l'autre. Consequence
voulue : le commentaire suit la recette lors d'un echange de creneaux entre chefs
(`mealTransfer` deplace les lignes, donc leur `note`).

### Regles

- Facultatif. Un commentaire vide ou compose uniquement d'espaces est stocke `null`,
  jamais chaine vide (normalisation cote backend **et** frontend).
- Max 300 caracteres, valide cote backend (`ingredientSchema.note`) et borne cote
  frontend (`maxLength` du champ) pour que la limite se voie a la saisie.
- Meme droit d'edition que le reste de la recette : chef du repas ou responsable
  cuisine (aucune regle de permission nouvelle).
- Visible partout ou la recette est lue, en particulier par l'equipe courses.

### UI

Le champ ne doit pas alourdir une liste de 15 lignes dont la plupart n'ont pas de
commentaire :

- Ligne sans commentaire : un bouton 💬 discret en fin de ligne.
- Au clic : une zone de texte s'ouvre sous la ligne, sur toute la largeur (les
  precisions sont souvent longues, un input d'une ligne ne suffit pas).
- Ligne qui a deja un commentaire : la zone est affichee d'office, sans avoir a
  rouvrir.
- En lecture (modale details) : le commentaire s'affiche sous la ligne, en italique
  atenue, jamais tronque.

## 2. Correctif des 429

### Symptome

Pendant la saisie des ingredients : `429` en cascade sur `/api/kitchen/products`,
`PATCH .../meals/:id`, `/kitchen/swaps`, et jusque sur `/api/auth/me` et
`/api/auth/discord` — l'app tentait alors une re-authentification, donnant
l'impression d'une session cassee.

### Causes (cumulatives)

1. **`TRUST_PROXY=1` alors que la chaine compte 2 proxys** (Traefik -> nginx ->
   backend). Express resolvait donc `req.ip` a l'IP interne de Traefik, **identique
   pour tout le monde** : le rate limiter comptait tous les utilisateurs de l'app dans
   un seul compteur de 100 req/min. C'est la cause principale — le quota etait
   partage, pas individuel.
2. **Amplification par le temps reel.** Un `PATCH` sur un repas emet
   `kitchen:meal-changed` a toute la room. Chaque client connecte repondait par
   `refetchAll` = 3 GET, et l'auteur du PATCH ajoutait son propre `onChanged`. Une
   seule frappe de chef pouvait donc declencher des dizaines de GET, multipliees par
   le nombre de personnes ayant la page ouverte.
3. **Autocompletion trop bavarde** : recherche des le 1er caractere avec 200 ms de
   debounce, soit une requete par syllabe tapee (`c`, `con`, `conco`, `concomb`,
   `concombre` visibles dans les logs).
4. **Auto-save des listes** au meme debounce qu'un champ texte simple (600 ms), alors
   que chaque envoi reecrit la liste entiere et qu'une liste se remplit par rafales.
5. **Plafonds sous le plancher d'usage legitime** : 100 req/min global et 30
   ecritures/min ne couvraient pas une saisie de recette, meme sans les points
   ci-dessus.

### Correctifs

| Cause | Correctif                                                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `TRUST_PROXY` devient une vraie variable lue par `config/env` (`num`, defaut 0) ; `2` en prod et preprod. Le quota redevient par utilisateur.                                                       |
| 2     | Coalescence des refetch dans `useKitchenData` (un timer par ressource, 30 ms) + `kitchen:meal-changed` ne refetch plus les listes d'echanges (elles ont leur propre evenement).                     |
| 3     | Minimum 2 caracteres, debounce 350 ms, et garde anti-reponse-hors-ordre.                                                                                                                            |
| 4     | Debounce des listes porte a 1200 ms, avec **filet de securite au demontage** ajoute a `useDebouncedSave` (sinon un debounce plus long ferait perdre la derniere saisie a la fermeture de l'onglet). |
| 5     | Global 100 -> 300 req/min ; ecritures 30 -> 120/min.                                                                                                                                                |

Les plafonds visent l'abus, pas l'usage intensif : plusieurs personnes partagent
souvent une IP (wifi du lieu, NAT mobile) et le temps reel genere du trafic legitime.

### Non-regression a surveiller

`TRUST_PROXY` doit suivre toute evolution de la chaine de proxys. S'il est trop
**haut**, un client pourrait forger son `X-Forwarded-For` et se donner un quota
neuf a volonte ; trop **bas**, tout le monde repartage un compteur. Test manuel
dedie ajoute (`docs/MANUAL_TESTING.md` 12.2).

## 3. CSP : script inline bloque

Constate dans les memes logs, independant des 429 :

```
Executing inline script violates the following Content Security Policy directive
'script-src 'self''  (hash sha256-iTKo4WvpmKtu9a2Fu4qKUV/rCLqA2y9MpztMloS5Lh8=)
```

Le hash correspond au script anti-flash de theme inline dans `index.html`. La CSP de
prod (`frontend/Dockerfile`) interdit l'inline : ce script ne s'executait donc
**jamais** en prod, et le theme enregistre ne s'appliquait pas avant le premier
rendu.

Correctif : extraction dans `frontend/public/theme-init.js`, charge en bloquant
depuis `<head>`. Preferee a l'ajout du hash dans la CSP, qu'il faudrait mettre a jour
a chaque modification du script sous peine de le voir redevenir inoperant en silence.

## Perimetre exclu

Le module courses (agregation des ingredients par `Product`, conversion d'unites,
liste de courses consolidee) reste hors perimetre, cf `CookV1/SPEC_COOKING.md`. La
`note` est concue pour lui : quand ce module arrivera, il devra remonter les
commentaires des lignes agregees plutot que les ignorer — une meme denree pouvant
porter des commentaires differents selon les recettes.
