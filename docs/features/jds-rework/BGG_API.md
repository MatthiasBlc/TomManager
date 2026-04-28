# BGG XML API2 — Reference

Source : https://boardgamegeek.com/wiki/page/BGG_XML_API2
Auth info : https://boardgamegeek.com/thread/3539581/xml-api-read-this-for-uninterrupted-access
Registration : https://boardgamegeek.com/using_the_xml_api

---

## Authentification

BGG impose desormais l'enregistrement des applications pour utiliser l'API.
- Enregistrer l'application sur `boardgamegeek.com/using_the_xml_api` pour obtenir un token
- Les requetes doivent inclure un header `Authorization` (format exact a confirmer apres enregistrement)
- **Phase 2 (actuelle)** : auth optionnelle mais recommandee
- **Phase 3 (a venir)** : auth obligatoire — a prevoir des maintenant

Token a stocker dans `BGG_API_TOKEN` (variable d'environnement).

---

## Base URL

```
https://boardgamegeek.com/xmlapi2/
```

Ne pas utiliser le sous-domaine `www.` — peut interférer avec l'auth.

---

## Endpoints utilises par TomManager

### Search
```
GET /xmlapi2/search?query=<q>&type=boardgame
```
Retourne une liste de jeux correspondant a la recherche.

### Thing (detail d'un jeu)
```
GET /xmlapi2/thing?id=<bggId>&stats=1
```
Retourne les details complets d'un jeu : nom, annee, joueurs min/max, duree, description, image.

---

## Codes HTTP importants

| Code | Signification | Comportement attendu |
|------|--------------|----------------------|
| 200  | OK | Traiter la reponse normalement |
| 202  | Queued (Collection uniquement) | **Ne concerne pas TomManager** — on n'utilise pas `/collection` |
| 401  | Non autorise | Log explicite, ne pas crasher, `bggAvailable: false` |
| 500/503 | Rate limit / serveur charge | Retry avec backoff — BGG recommande 5s entre les requetes |

**Note importante** : BGG retourne **500/503** pour le throttling, **pas 429**. La gestion du 202 (retry) ne concerne que l'endpoint `/collection` que TomManager n'utilise pas.

---

## Rate limiting

- Attendre au minimum **5 secondes** entre les requetes pour eviter le throttling
- En cas de 500/503 : retry avec backoff (2s / 4s / 8s, max 3 tentatives)

---

## Description des champs retournes (`/thing`)

| Champ XML | Champ DB | Notes |
|-----------|----------|-------|
| `@_id` | `externalId` | ID BGG |
| `name[@_type=primary][@_value]` | `name` | Prendre le nom de type "primary" |
| `yearpublished[@_value]` | `yearPublished` | |
| `minplayers[@_value]` | `minPlayers` | |
| `maxplayers[@_value]` | `maxPlayers` | |
| `playingtime[@_value]` | `playingTime` | En minutes |
| `description` | `description` | Contient des entites HTML — decoder avec `he` |
| `image` | `imageUrl` | Peut commencer par `//cdn...` — normaliser en `https://` |

---

## Sanitisation obligatoire

- **Description** : decoder les entites HTML avec la librairie `he` (ex: `&#10;` → retour ligne), puis supprimer les balises HTML restantes
- **imageUrl** : normaliser `//cdn.boardgamegeek.com/...` → `https://cdn.boardgamegeek.com/...`
