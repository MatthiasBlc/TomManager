# Spec : Migration API BoardGameGeek (Phase 14)

## Contexte et diagnostic

### Pourquoi c'est casse

Depuis **juillet 2025**, BGG exige un Bearer Token sur toutes les requetes
`boardgamegeek.com/xmlapi2/*`. Les requetes sans token retournent :

```
HTTP 401 Unauthorized
Body: "Unauthorized. See https://boardgamegeek.com/using_the_xml_api"
```

Le code actuel (`backend/src/services/bgg.ts`) fait des requetes sans en-tete
d'authentification. Les fonctions `searchBGG()` et `fetchBGGThing()` catchent
silencieusement les erreurs et retournent `[]` / `null`, ce qui rend la feature
muette sans lever d'alerte visible.

### Ce qui n'a PAS change

La structure de l'API XML v2 est identique — endpoints, format XML, parametres.
**Seule l'authentification est nouvelle.** Le travail est minimal.

---

## Obtention du token

1. Creer ou utiliser un compte BGG : `https://boardgamegeek.com`
2. Enregistrer l'application : `https://boardgamegeek.com/applications/create`
   - Nom : "TomManager"
   - Description : "Event planning tool for tabletop gaming sessions"
   - URL du projet (optionnel)
3. Approbation par BGG : generalement < 24h, parfois immediate
4. Generer le Bearer Token dans le dashboard de l'application
5. Le stocker en variable d'environnement : `BGG_API_TOKEN=<token>`

**Important** : l'URL d'enregistrement est `https://boardgamegeek.com/applications/create`,
pas un endpoint API. C'est un formulaire web.

---

## Comportements particuliers de l'API BGG a couvrir

### 1. HTTP 202 — Processing

Pour les requetes sur des ressources en cache froid, BGG peut repondre :

```
HTTP 202 Accepted
Retry-After: 5
Body: (vide ou XML minimal)
```

Le code actuel considere tous les 2xx comme succes et essaie de parser du XML vide,
ce qui retourne `null` silencieusement. Il faut implementer un vrai retry avec
backoff sur 202.

**Comportement attendu** : retry jusqu'a 3 fois avec delai croissant (2s, 4s, 8s).
Si toujours 202 apres 3 tentatives : retourner `null`/`[]` et logger un warning.

### 2. HTTP 429 — Rate limit

BGG n'a pas documente publiquement ses limites. Historiquement : ~2 req/sec.
En cas de 429, le service doit :

- Respecter le header `Retry-After` si present
- Sinon attendre 10s avant de reessayer
- Ne pas reessayer plus d'une fois sur un 429 (eviter les boucles)

### 3. HTTP 401 — Token invalide ou expire

- Logger l'erreur explicitement (pas silencieux)
- Retourner `[]`/`null` avec un message clair dans les logs
- **Ne pas crasher** l'app — la feature BGG est optionnelle

### 4. Absence de token (`BGG_API_TOKEN` non configure)

- Ne pas appeler BGG du tout
- Logger un warning au demarrage si le token est absent
- La recherche retourne uniquement les resultats locaux (degraded mode)
- Le flag `bggAvailable: false` peut etre expose dans `/health`

### 5. Timeout et network errors

Comportement actuel (a conserver) :

- Timeout : 5 secondes
- MAX_RETRIES : 1 (pour les erreurs reseau uniquement, pas pour 202/429)

---

## Architecture du service bgg.ts apres migration

### Variables d'environnement

| Variable        | Requis    | Description                                 |
| --------------- | --------- | ------------------------------------------- |
| `BGG_API_TOKEN` | Optionnel | Bearer token BGG. Si absent : mode degrade. |

A ajouter dans `backend/src/config/env.ts` comme `str({ default: "" })`.

### Logique fetchWithRetry (refactoree)

```
fetchWithRetry(url, maxRetries=3):
  Pour chaque tentative :
    1. Fetch avec Authorization: Bearer <token> (si token present)
    2. Si 202 : attendre delai croissant, retry
    3. Si 429 : attendre Retry-After (ou 10s), retry une seule fois
    4. Si 401 : logger error, throw (pas de retry)
    5. Si autre erreur HTTP : throw
    6. Si OK : retourner le body
```

### Signature des fonctions (inchangee)

Les interfaces `BGGSearchResult` et `BGGThingDetail` et les signatures de
`searchBGG(query)` et `fetchBGGThing(bggId)` **ne changent pas**.
L'appelant (`boardGame.ts`) n'a rien a modifier.

---

## Strategie de test

### Tests unitaires : bgg.ts

Actuellement inexistants. A creer dans un fichier dedie
`backend/src/__tests__/unit/bgg.test.ts`.

Scenarios a couvrir :

- Auth header present si token configure
- Pas d'auth header si token absent
- Retry sur 202 avec backoff
- Pas de retry infini sur 429
- Retour null/[] sur 401 sans crash
- Parse correct du XML search (format array + format objet)
- Parse correct du XML thing (tous les champs)
- Retour [] si BGG renvoie 0 resultats
- Timeout reseau : retourne [] sans crash

### Tests d'integration : boardGame.test.ts

Les tests existants mockent `bggService.searchBGG` et `bggService.fetchBGGThing`
au niveau service — **ils continuent de fonctionner tels quels**, le mock
bypasse le reseau.

A ajouter : un test qui verifie que si `searchBGG` leve une exception,
`boardGame.service` retourne quand meme les resultats locaux (resilience).

### Test live (optionnel, non-CI)

Un fichier `backend/src/__tests__/manual/bgg-live.test.ts` (ignore par vitest
en CI) qui effectue une vraie requete BGG pour verifier le token. A lancer
manuellement avant deploy.

```typescript
// vitest.config : exclude ['**/__tests__/manual/**']
it.skipIf(!process.env.BGG_API_TOKEN)("live search returns results", async () => {
  const results = await searchBGG("Catan");
  expect(results.length).toBeGreaterThan(0);
});
```

### E2E Playwright

Le test `e2e/planning.spec.ts` skippe actuellement la recherche BGG
(note "BGG : API cassee"). Une fois la feature reparee, ajouter un test dans
`e2e/boardgames.spec.ts` :

- Rechercher "Catan" → voir au moins un resultat BGG
- Cliquer sur un resultat → l'ajouter a l'event
- Verifier qu'il apparait dans la liste

---

## Impact sur le reste du code

| Fichier                                         | Changement                                        |
| ----------------------------------------------- | ------------------------------------------------- |
| `backend/src/services/bgg.ts`                   | Refactoring fetchWithRetry (auth + retry 202/429) |
| `backend/src/config/env.ts`                     | Ajouter `BGG_API_TOKEN: str({ default: "" })`     |
| `backend/src/app.ts`                            | Warning au demarrage si token absent              |
| `backend/src/__tests__/unit/bgg.test.ts`        | **NOUVEAU** — tests unitaires bgg.ts              |
| `backend/src/__tests__/manual/bgg-live.test.ts` | **NOUVEAU** — test live optionnel                 |
| `e2e/boardgames.spec.ts`                        | **NOUVEAU** — scenario E2E search + ajout BGG     |
| `.env.example`                                  | Ajouter `BGG_API_TOKEN=`                          |
| `docker-compose.yml`                            | Ajouter `BGG_API_TOKEN` dans env backend          |
| `docker-compose.prod.yml` / `preprod.yml`       | Idem                                              |
| `.github/workflows/deploy.yml`                  | Ajouter `BGG_API_TOKEN` dans les secrets          |

---

## Zones d'ombre et decisions

### Token expiry

BGG n'a pas documente la duree de vie des tokens. Si le token expire, on observe
un 401. Le mecanisme de degraded mode (retour [] sans crash) couvre ce scenario.
Il n'y a pas de rotation automatique a implementer — l'operateur renouvelle le
token manuellement et met a jour la variable d'environnement.

### Token en CI

Les tests unitaires et d'integration **ne font pas de requetes reelles BGG** — ils
mockent au niveau `fetch` ou au niveau service. `BGG_API_TOKEN` n'est pas
necessaire en CI pour les tests unitaires.

Le job `test-e2e` peut recevoir `BGG_API_TOKEN` comme secret GitHub si on veut
valider le flow complet. Sans le secret, le test E2E BGG est skippe.

### Plusieurs instances / scalabilite

Chaque instance backend partage le meme token. Pas de probleme de concurrence —
BGG rate-limit par IP/token, pas par connexion.

### Description HTML dans BGG

Le champ `description` retourne par l'API BGG contient du HTML (entites encodees
comme `&#10;`, `&mdash;`, balises `<br/>`). L'interface actuelle stocke ce HTML
brut en DB. Le frontend affiche ce champ via `dangerouslySetInnerHTML` ou doit
le sanitiser.

**Decision** : sanitiser cote backend avant stockage — supprimer les balises HTML,
decoder les entites. Librairie : `he` (decoder entites) + regex simple pour
supprimer les balises. Pas de DOMParser en Node.

### Image URL BGG

Le champ `imageUrl` de l'API BGG retourne une URL relative style
`//cf.geekdo-images.com/...` (sans scheme). A normaliser en
`https://cf.geekdo-images.com/...` avant stockage.

---

## Definition of done

- [ ] `BGG_API_TOKEN` configure en variable d'environnement dev + prod
- [ ] `bgg.ts` : Bearer token envoye si token present
- [ ] `bgg.ts` : retry sur 202, backoff sur 429, log sur 401
- [ ] Degraded mode : si token absent, recherche retourne uniquement resultats locaux
- [ ] Warning au demarrage si token absent
- [ ] Tests unitaires `bgg.test.ts` : 100% des comportements couverts
- [ ] Tests d'integration existants : toujours verts (aucun changement de contrat)
- [ ] Description HTML sanitisee avant stockage
- [ ] Image URL normalisee en `https://`
- [ ] Test live manuel verifie avec vrai token
- [ ] E2E `boardgames.spec.ts` : search + ajout fonctionne
- [ ] Docs : README + variables d'environnement mises a jour
