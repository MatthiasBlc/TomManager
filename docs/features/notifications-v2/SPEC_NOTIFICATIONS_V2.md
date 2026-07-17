# Spec - Notifications v2 (juillet 2026)

Audit complet du systeme de notifications + plan d'amelioration.
Contrainte forte : **application en production** avec utilisateurs et events actifs.
Toutes les modifications doivent etre additives et deployables sans regression
(voir section "Strategie de deploiement sans regression").

---

## 1. Etat des lieux

### Architecture existante

- **DB** : modele `Notification` (Prisma) — `userId`, `type` (enum), `title`, `message`,
  `metadata` (Json), `read`, `readAt`, `createdAt`. Index `[userId, read, createdAt desc]`.
- **Backend** : `services/notification.ts` (create, createBulk, list pagine cursor,
  unread-count, markAsRead, markAllAsRead, delete) + 5 endpoints REST `/api/notifications`.
- **Temps reel** : Socket.io, room personnelle `user:<userId>` auto-jointe a la connexion,
  evenement `notification:new` emis a la creation.
- **Frontend** : hook `useNotifications` (fetch initial, ecoute socket, refetch a la
  reconnexion) + `NotificationBell` (dropdown desktop / MobileSheet mobile) +
  `NotificationItem` (icone par type, time-ago, clic = mark-read + deep-link
  `/events/:eventId/planning?table=<tableId>`).
- Un seul bell monte a la fois (branchement `isMobile` dans `Navbar`).

### Ce qui fonctionne

- Securite (ownership 403, requireAuth partout, socket authentifie par session).
- Pagination cursor-based, limite clampee a 50.
- Refetch auto apres reconnexion socket (rattrape les notifs manquees).
- Deep-link `?table=` gere dans PlanningTab, y compris table supprimee (toast + nettoyage URL).
- Textes UI en francais accentue generes backend (conforme convention).
- 38 tests integration backend + 22 tests front.

### Notifications existantes (7 types actifs)

| Type                     | Declencheur                                        | Destinataire            |
| ------------------------ | -------------------------------------------------- | ----------------------- |
| `TABLE_UPDATED`          | Table modifiee par MJ/admin                        | Participants (sauf auteur/demotes) |
| `TABLE_DELETED`          | Suppression table (delete ou MJ quitte)            | Participants            |
| `WAITLIST_PROMOTED`      | Promotion (auto apres depart/kick, ou manuelle)    | Joueur promu            |
| `WAITLIST_DEMOTED`       | Retrogradation (manuelle ou reduction de places)   | Joueur retrograde       |
| `RESERVED_SEAT_ASSIGNED` | MJ attribue une place reservee                     | Joueur                  |
| `PLAYER_KICKED`          | Expulsion d'une table                              | Joueur expulse          |
| `PARTICIPANT_REMOVED`    | Retrait d'un event                                 | Participant retire      |

`EVENT_UPDATED` et `EVENT_DELETED` existent dans l'enum + icones front mais ne sont
**jamais crees** (code mort — voir bug B5).

---

## 2. Bugs confirmes (cause racine identifiee)

### B1 — Desynchronisation multi-appareils (reporte par les utilisateurs) — P0

**Symptome** : une notif lue/supprimee sur telephone reste affichee non-lue sur PC
(et inversement), jusqu'a rechargement de la page.

**Cause racine** : `markAsRead`, `markAllAsRead` et `deleteNotification`
(`backend/src/services/notification.ts`) ne font **aucune emission socket**.
Seul `notification:new` existe. Chaque appareil/onglet garde donc son etat local
(`useNotifications`) jusqu'au prochain fetch (reload ou reconnexion socket).

**Fix** : emettre vers la room `user:<userId>` :

- `notification:read` `{ id }` apres markAsRead
- `notification:read-all` `{}` apres markAllAsRead
- `notification:deleted` `{ id }` apres delete

Cote front, `useNotifications` ecoute ces 3 evenements et met a jour liste + compteur.
Bonus naturel : ca synchronise aussi plusieurs onglets sur un meme appareil.
Note : l'appareil emetteur recevra aussi l'evenement (il est dans la room) — les
handlers doivent etre idempotents. Regle exacte (la liste locale est paginee, ne
JAMAIS recalculer le compteur a partir d'elle) :

- `notification:read { id }` : si l'item est dans la liste ET deja `read` -> no-op
  complet (c'est l'echo de sa propre action). Sinon : marquer lu si present, et
  decrementer le compteur (floor 0) — l'item peut etre au-dela de la page chargee,
  le decrement reste correct car l'evenement est emis une seule fois par action.
- `notification:read-all` : tout marquer lu localement, compteur a 0 (idempotent).
- `notification:deleted { id }` : si l'item est present et non lu -> decrementer ;
  le retirer de la liste ; id absent -> no-op sur la liste, no-op sur le compteur
  (si l'item n'est pas charge on ne sait pas s'il etait lu : accepter la derive
  rare plutot qu'un compteur negatif ; elle se corrige au prochain fetch).

### B2 — Le panneau ne se ferme pas au clic sur une notification — P0

Cliquer une notif navigue mais laisse le dropdown ouvert (desktop) ou la MobileSheet
affichee par-dessus la page de destination (mobile) : l'utilisateur navigue "en aveugle".
**Fix** : passer un `onNavigate`/`onClose` a `NotificationList` -> `NotificationItem`,
appele au clic avant `navigate()`.

### B3 — Clic sur `PARTICIPANT_REMOVED` = impasse (403) — P0

La notif "retire de l'evenement" deep-link vers `/events/:eventId/planning`, auquel
l'utilisateur n'a justement plus acces (`requireEventParticipant`).
**Fix** : table de routage par type cote `NotificationItem` (voir section 4).
`PARTICIPANT_REMOVED` (et futur `EVENT_DELETED`) -> `/events`.

### B4 — `createNotification` bloquant apres l'action metier — P1

Aux call-sites post-transaction (kick, promote, remove...), un echec de l'insert
notification fait echouer l'endpoint en 500 alors que l'action a reussi.
**Fix** : wrapper `try/catch` + log (la notification est un effet secondaire,
pas le contrat de l'endpoint). Ne PAS deplacer dans la transaction metier.

### B5 — `EVENT_UPDATED` / `EVENT_DELETED` jamais emis — P1

`services/event.ts` ne cree aucune notification et n'emet aucun evenement socket
sur update/delete. Les participants ne sont jamais prevenus qu'un event a change
de date ou a ete supprime. Cablage en section 3.

### B6 — Doublon possible dans la liste via le socket — P2

Le handler `notification:new` prepend sans dedoublonnage : en cas de course avec un
refetch (reconnexion), une notif peut apparaitre deux fois.
**Fix** : ignorer si l'id est deja present dans la liste.

---

## 3. Nouvelles notifications (inventaire complet)

Principe directeur : **le MJ doit savoir ce qui se passe sur sa table sans ouvrir l'app
en continu**, et les participants doivent etre prevenus des changements d'event.
Anti-bruit : jamais de notification a l'auteur de l'action ; pas de notification pour
les actions purement consultatives.

### 3.1 Cote MJ (le manque principal — P0 fonctionnel)

Nouveaux types enum + call-sites dans `services/gameTable.ts` :

| Type                  | Declencheur (call-site)                                | Destinataire | Titre / message (UI, accents corrects)                                  |
| --------------------- | ------------------------------------------------------ | ------------ | ----------------------------------------------------------------------- |
| `GM_PLAYER_JOINED`    | `joinTable` -> status CONFIRMED                        | MJ (createdBy) | "Nouveau joueur" / "<displayName> a rejoint ta table \"<titre>\""       |
| `GM_PLAYER_WAITLISTED`| `joinTable` -> status WAITLIST                         | MJ           | "Joueur en liste d'attente" / "<displayName> est en liste d'attente sur \"<titre>\"" |
| `GM_PLAYER_LEFT`      | `leaveTable` (joueur non-MJ)                           | MJ           | "Un joueur a quitté ta table" / "<displayName> a quitté \"<titre>\""    |
| `GM_TABLE_FULL`       | `joinTable` quand le join remplit la derniere place normale | MJ       | "Table complète" / "Ta table \"<titre>\" est complète"                  |

Details :

- Ne jamais notifier le MJ de ses propres actions (kick, promote, demote : il est l'auteur).
- Cas MJ-joueur (JDS/gmIsPlayer) : si `userId === createdBy` dans joinTable, pas d'auto-notif.
- L'auto-promotion apres un depart genere deja `WAITLIST_PROMOTED` pour le joueur ;
  le MJ recoit `GM_PLAYER_LEFT` — pas besoin d'un type supplementaire.
- `displayName` : utiliser `displayName ?? username` (meme fallback que la navbar).
- `GM_TABLE_FULL` s'emet en plus de `GM_PLAYER_JOINED` (2 notifs) uniquement au join
  qui remplit la table ; la donnee (`openSeats` apres insert) est deja calculee dans
  la transaction de `joinTable`.

**Angle mort admin (decouvert a l'audit, a corriger dans le meme lot)** : les routes
table sont en `requireTableGMOrAdmin` — un admin peut modifier ou supprimer la table
d'un autre MJ. Or `updateTable`/`deleteTable` ne notifient que les `participants`,
et un MJ de JDR sans `gmIsPlayer` n'a pas de ligne participant : **sa table peut etre
modifiee ou supprimee par un admin sans qu'il le sache**. Fix (types existants,
aucune migration) : dans `updateTable` et `deleteTable`, inclure `createdBy` dans les
destinataires quand `createdBy !== auteur` et qu'il n'y est pas deja (meme mecanique
que le cas `gmSeatAdded` deja present dans `updateTable`). Le kick/promote/demote
par un admin sur la table d'un MJ reste non notifie au MJ en v2 (rare, voir Lot F).

### 3.2 Cote participants d'un event (cablage des types morts)

Call-sites dans `services/event.ts` :

| Type            | Declencheur                                       | Destinataires                          | Message                                                        |
| --------------- | ------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `EVENT_UPDATED` | `updateEvent` si champ significatif change        | Participants (sauf auteur)             | "Événement modifié" / "L'événement \"<nom>\" a été modifié"    |
| `EVENT_DELETED` | `deleteEvent`                                     | Participants (sauf auteur)             | "Événement supprimé" / "L'événement \"<nom>\" a été supprimé"  |

Details :

- **Champs significatifs** pour EVENT_UPDATED : nom, dates, lieu/description si existants.
  Comparer avant/apres et ne rien emettre si seul un champ cosmetique change (anti-bruit).
- `deleteEvent` : recuperer la liste des participants AVANT le delete cascade,
  creer les notifs APRES le delete (metadata sans deep-link vers l'event, voir section 4).
- La purge (`purgeEvent`) reste **volontairement silencieuse** (comportement actuel conserve).
- Ajouter aussi les emissions socket `event:updated` / `event:deleted` vers la room
  `event:<id>` (aujourd'hui absentes) pour le rafraichissement live des pages ouvertes —
  optionnel mais coherent avec le reste du systeme.

### 3.3 Deliberement hors scope v2 (a rediscuter plus tard)

- `TABLE_CREATED` broadcast a tous les participants d'un event : potentiellement
  tres bruyant (events avec beaucoup de monde). A ne faire qu'avec des preferences
  d'opt-in (phase 5).
- Rappel "ta table commence dans 1h" : necessite un scheduler (cron backend). Utile
  mais chantier separe (phase 5).
- Notifications push navigateur (Web Push / service worker) : gros chantier, hors scope.
- Notification au createur d'event quand un membre Discord est importe : sans action
  possible, bruit pur — non retenu.

---

## 4. Comportement au clic — table de routage par type

Centraliser dans `NotificationItem` (remplace l'heuristique actuelle basee metadata) :

| Type                                                      | Destination                                   |
| --------------------------------------------------------- | --------------------------------------------- |
| `TABLE_UPDATED`, `WAITLIST_*`, `RESERVED_SEAT_ASSIGNED`, `GM_*` | `/events/:eventId/planning?table=<tableId>`   |
| `TABLE_DELETED`, `PLAYER_KICKED`                          | `/events/:eventId/planning` (sans `?table` : la table/participation n'existe plus) |
| `EVENT_UPDATED`                                           | `/events/:eventId/planning`                   |
| `EVENT_DELETED`, `PARTICIPANT_REMOVED`                    | `/events` (l'acces a l'event n'existe plus)   |
| Type inconnu (forward-compat)                             | metadata.eventId si present, sinon rien       |

Dans tous les cas : mark-as-read + fermeture du panneau (fix B2).

Icones front a ajouter : `GM_PLAYER_JOINED` (nouvelle recrue), `GM_PLAYER_WAITLISTED`,
`GM_PLAYER_LEFT`, `GM_TABLE_FULL`. Le `default: "🔔"` existant couvre deja tout type
inconnu (garantie de forward-compat pendant le deploiement).

---

## 5. Retention (P2)

Aucune purge aujourd'hui : la table grossit indefiniment.

- Job quotidien backend (setInterval au boot ou node-cron) :
  - supprimer les notifications **lues** de plus de 30 jours ;
  - supprimer les notifications **non lues** de plus de 90 jours.
- `deleteMany` simple sur l'index existant, aucun impact utilisateur perceptible.

---

## 6. Preferences de notification (P3, optionnel)

Le systeme de preferences existe deja (`/api/me/preferences`, liste blanche de cles).
Si le volume devient genant apres la v2, ajouter des cles d'opt-out par categorie :

- `notif.gmActivity` (GM_* — active par defaut)
- `notif.eventChanges` (EVENT_* — active par defaut)

Le filtre s'applique a la **creation** (backend, avant insert) — pas a l'affichage.
A ne construire que si le besoin est confirme a l'usage.

---

## 7. Strategie de deploiement sans regression (production)

Ordre impose et garanties :

1. **Migration Prisma additive uniquement** : ajout de valeurs a l'enum
   `NotificationType` (`ALTER TYPE ... ADD VALUE`). Aucune colonne modifiee,
   aucune donnee touchee. Rappel ops : migration creee en container = root:root,
   `chown 1003:1003` avant commit.
2. **Frontend deja tolerant** : types inconnus -> icone 🔔 + navigation par
   metadata. Un backend deploye avant le front ne casse rien.
3. **Nouveaux evenements socket additifs** : un front pas encore a jour ignore
   silencieusement `notification:read`/`read-all`/`deleted` (Socket.io ignore les
   evenements sans listener).
4. **Aucun changement de semantique** sur les 7 types existants ni sur les
   endpoints REST existants (memes routes, memes payloads).
5. Chaque phase est livrable et testable independamment (voir ROADMAP), avec
   tests d'integration backend + tests front a chaque lot, `npm test` complet
   avant merge, et verification manuelle du flux temps reel a deux navigateurs.

---

## 8. Tests a ajouter

- **Backend integration** : emissions socket sur read/read-all/delete (spy emitter) ;
  GM_* sur join/waitlist/leave/table-full (y compris cas MJ-joueur = pas d'auto-notif) ;
  EVENT_UPDATED (champ significatif vs cosmetique), EVENT_DELETED (participants
  notifies, createur exclu) ; createNotification en echec ne fait pas echouer l'action.
- **Front (vitest)** : handlers socket read/read-all/deleted (mise a jour liste +
  compteur, idempotence) ; dedoublonnage notification:new ; fermeture du panneau au
  clic ; table de routage par type (notamment PARTICIPANT_REMOVED -> /events).
- **E2E (nouveau, aucun existant aujourd'hui)** : scenario deux contextes navigateur —
  user A rejoint la table de user B, B voit la notif apparaitre en live, B clique
  (panneau se ferme, modale table s'ouvre), B marque lu, le badge de son deuxieme
  onglet se met a jour.
