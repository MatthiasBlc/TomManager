# Spec : Vue Calendrier avec Drag & Drop

## Contexte

La page Planning (`/events/:eventId/planning`) affiche actuellement les tables de jeu
sous forme de cards groupees par date (`TimelineView`). Pour un evenement de 3-4 jours
avec de nombreuses tables simultanees, cette vue ne permet pas de visualiser les conflits
horaires ni de repositionner les tables facilement.

La vue calendrier apporte : axe temporel, tables simultanees cote a cote, deplacement par
drag & drop, redimensionnement, et mise a jour en temps reel.

---

## Perimetre

### Inclus
- Vue calendrier multi-jours sur la duree de l'event
- Toggle liste / calendrier dans `PlanningTab`
- Drag & drop pour deplacer une table (changer startDateTime / endDateTime)
- Resize pour changer la duree (tirer le bord bas)
- Tables simultanees affichees en colonnes cote a cote
- Grille de snap a 15 minutes
- Borne stricte aux dates de l'event (impossible de sortir de la plage)
- Warning visuel si une table chevauche une autre table du meme GM
- Mise a jour temps reel via Socket.io existant
- Mobile-first : meme experience que desktop (drag long-press sur touch)
- Color coding par statut (GM, inscrit, autre)

### Hors perimetre
- Creation de table en cliquant un creneau vide (future feature)
- Vue ressource / salle (pas de concept de salle dans le modele)
- Navigation hors de la plage de l'event

---

## User Stories

| Acteur       | Action                                        | Resultat attendu                              |
|--------------|-----------------------------------------------|-----------------------------------------------|
| Participant  | Bascule sur la vue calendrier                 | Voit toutes les tables sur un axe horaire     |
| Participant  | Voit deux tables au meme creneau              | Elles sont affichees cote a cote              |
| GM           | Drag sa table vers un nouveau creneau         | Table mise a jour, autres clients voient le changement |
| GM           | Resize le bas de sa table                     | Duree modifiee, snap a 15 min                 |
| GM           | Drag sa table hors de la plage event          | Bloque visuellement, impossible de deposer   |
| GM           | Drag sa table vers un creneau qui chevauche une autre de ses tables | Warning toast, action autorisee |
| Admin        | Drag n'importe quelle table                   | Meme comportement que le GM de cette table    |
| Participant  | Un autre GM deplace une table                 | Le calendrier se met a jour en temps reel     |
| Utilisateur  | Change de vue (liste <-> calendrier)          | Preference sauvegardee en localStorage        |

---

## Design UI

### Toggle

Dans le header de `PlanningTab`, a cote du bouton "Create Table" (desktop) ou du FAB (mobile) :

```
[=] [Cal]   ← icones liste / grille
```

Un toggle avec deux etats : `list` | `calendar`. Sauvegarde dans
`localStorage` sous la cle `planning_view_preference`.

### Vue calendrier (desktop)

```
|  Lun 14   |  Mar 15   |  Mer 16   |
|  09:00    |           |           |
|  -------- |           |           |
|  [Table A]| [Table B] |           |
|  [Table C]|           |           |
|  10:00    |           | [Table D] |
|  ...      |           |           |
```

- En-tetes de colonnes : `lun. 14 jan.`
- Heure affichee a gauche, grille de 15 min
- La vue s'ouvre sur le debut de l'event (scroll auto)
- Hauteur fixe de la zone calendrier : 100% viewport height - navbar
- Scroll vertical pour naviguer dans la journee

### Vue calendrier (mobile)

Identique a Google Calendar mobile :
- Une seule journee visible a la fois
- Swipe horizontal gauche/droite pour changer de jour
- Indicateur de jour en haut : `< Lun 14 | Mar 15 | Mer 16 >`
- Drag via long-press (500ms) puis glisser
- Resize via poignee en bas du bloc (grab handle visible sur mobile)

### Rendu d'un bloc de table

```
+------------------------+
| Titre de la table      |
| 14:00 - 16:00  4/6 >  |
| [tag1] [tag2]          |
+------------------------+   ← poignee resize (4px, visible au hover/touch)
```

**Color coding (couleurs DaisyUI) :**

| Statut                    | Classe           |
|---------------------------|------------------|
| Je suis GM                | `bg-secondary`   |
| Je suis inscrit (CONFIRMED) | `bg-success`   |
| Je suis en waitlist       | `bg-warning`     |
| Autre table               | `bg-primary/70`  |

### Warning de chevauchement

Toast non-bloquant : `"Attention : cette table chevauche [Titre] sur la meme plage horaire."`
Affiché uniquement si deux tables du meme GM (ou tables dont l'utilisateur est GM) se chevauchent
apres le depot. Le PATCH est quand meme envoye (c'est l'organisateur qui gere son planning).

---

## Architecture technique

### Librairie : FullCalendar v6

```
@fullcalendar/react           # wrapper React
@fullcalendar/timegrid        # vue multi-jours avec axe horaire
@fullcalendar/interaction     # drag, resize, click (touch inclus)
```

Justification :
- MIT pour les plugins utilises (pas de plugins premium necessaires)
- Gestion native des events simultanees en colonnes
- Drag & resize avec snap inclus
- Support touch (long-press configurable)
- Bounds (validRange) supportees nativement
- Mature, teste en production

### Nouveaux fichiers

```
frontend/src/components/planning/
  CalendarView.tsx             # Composant principal FullCalendar
  CalendarEventBlock.tsx       # Rendu custom d'un bloc de table (eventContent)
```

### Fichiers modifies

```
frontend/src/components/planning/PlanningTab.tsx   # Toggle + passage de l'event aux vues
frontend/package.json                              # Ajout des deps FullCalendar
```

### Format des evenements FullCalendar

```ts
interface CalendarEvent {
  id: string;                  // table.id
  title: string;               // table.title
  start: string;               // table.startDateTime (ISO UTC)
  end: string;                 // table.endDateTime (ISO UTC)
  editable: boolean;           // isGM || isAdmin
  backgroundColor: string;     // selon statut
  borderColor: string;         // idem
  extendedProps: {
    table: TableSummary;
    isGM: boolean;
    currentUserStatus: string | null;
  };
}
```

### Config FullCalendar

```ts
<FullCalendar
  plugins={[timeGridPlugin, interactionPlugin]}
  initialView="timeGridEvent"   // vue custom : autant de colonnes que de jours de l'event
  // OU : initialView="timeGridDay" avec navigation manuelle
  visibleRange={{               // borner la navigation aux dates de l'event
    start: event.startDateTime,
    end: event.endDateTime,
  }}
  validRange={{                 // interdire le drag hors de la plage
    start: event.startDateTime,
    end: event.endDateTime,
  }}
  snapDuration="00:15:00"       // snap 15 min
  slotDuration="00:15:00"
  slotLabelInterval="01:00:00"  // label toutes les heures
  scrollTime={firstTableTime}   // scroll auto vers la premiere table
  editable={true}               // editable par event via l'option editable de CalendarEvent
  eventDrop={handleEventDrop}
  eventResize={handleEventResize}
  eventContent={CalendarEventBlock}
  headerToolbar={false}         // header custom dans PlanningTab
  height="calc(100vh - 160px)"
  locale="fr"
/>
```

**Nombre de jours affiche** :
- Calculer `nbDays = differenceInDays(event.endDateTime, event.startDateTime)` (max 7)
- Utiliser `initialView="timeGridDay"` si mobile avec navigation jour par jour
- Utiliser `timeGridNDays` (view personnalisee) sur desktop pour tout afficher d'un coup :
  ```ts
  views: {
    timeGridEvent: {
      type: 'timeGrid',
      duration: { days: nbDays },
    }
  }
  ```

### Flux drag & drop

```
1. User commence le drag d'un bloc
   → FullCalendar gere le visuel (ghost, snap)

2. User lache (eventDrop callback)
   → Verifier permissions (editable = false → revert auto par FC)
   → Appel PATCH /api/events/:eventId/tables/:tableId
      body: { startDateTime, endDateTime }
   → En cas d'erreur API : revert via revertFunc() + toast.error
   → En cas de succes : fetchTables() (le socket broadcast le fera aussi)
   → Verifier chevauchement avec autres tables du meme GM → toast warning si besoin

3. Socket.io recoit TABLE_UPDATED sur les autres clients
   → fetchTables() → setTables() → CalendarView re-render
```

### Flux resize

Identique au drag, seules `startDateTime` et `endDateTime` changent (startDateTime fixe,
endDateTime ajuste pour le resize bas ; si on supporte resize haut, startDateTime change).

### Optimistic update

Pour fluidite maximale (important pour remplacer Google Sheets) :
- Mettre a jour `tables` localement des le depot (avant l'API call)
- Si l'API echoue : revenir a l'etat precedent + revert FullCalendar

Implementation : conserver `previousTables` dans le handler, appeler `revertFunc()` de FC
et `setTables(previousTables)` sur erreur.

---

## Permissions (logique client)

```ts
// Dans CalendarView, pour chaque table
const canEdit = (table: TableSummary, currentUser: User): boolean => {
  if (currentUser.role === 'ADMIN') return true;
  return table.isGM; // isGM est deja calcule par le backend dans la liste
};
```

Le backend reste l'autorite : si quelqu'un contourne le client,
`requireTableGMOrAdmin` middleware rejetera le PATCH avec 403.

---

## Gestion des bornes (validRange)

FullCalendar avec `validRange` empeche de deposer un evenement hors de la plage.
Le feedback visuel natif de FC suffit (zone grisee hors plage).

Pour le resize : la poignee bas est bloquee a `event.endDateTime`.

---

## Stylisation

FullCalendar injecte ses propres classes CSS. Il faut :
1. Importer le CSS FC minimal : `import '@fullcalendar/common/main.css'` (ou via le bundle)
2. Surcharger avec des classes Tailwind dans un fichier `calendar.css` :
   - Couleurs de fond/bordure des slots : `bg-base-100`, `border-base-300`
   - Font, tailles : variables DaisyUI
   - Scrollbar : styles natifs du navigateur

Les blocs d'evenements sont entierement custom via `eventContent` → pas de surcharge CSS FC
pour les blocs eux-memes, on controle tout via `CalendarEventBlock.tsx`.

---

## Temps reel

Le hook `useEventSocket` dans `PlanningTab` ecoute deja `onTableUpdated → fetchTables`.
Aucune modification necessaire : quand un PATCH reussit, le socket broadcast est envoye
par le backend, et tous les clients (incluant l'auteur du drag) refetch les tables.

Pour eviter le double-fetch sur l'auteur du drag : apres un PATCH reussi, on peut skip
le prochain socket event pendant 500ms (flag `skipNextUpdate`), ou simplement accepter le
double-fetch (impact negligeable).

---

## Tests

### Tests unitaires (Vitest)

- `CalendarView.test.tsx` :
  - Rendu correct des tables comme evenements FC
  - `editable=false` sur les tables dont l'user n'est pas GM
  - Color coding selon statut

### Tests manuels a documenter dans `docs/MANUAL_TESTING.md`

- [ ] Toggle liste/calendrier : preference sauvegardee au refresh
- [ ] Drag une table → API PATCH appelee → calendrier mis a jour
- [ ] Drag hors de la plage event → impossible de deposer
- [ ] Resize → duree mise a jour, snap 15min respecte
- [ ] Erreur API drag → revert visuel + toast erreur
- [ ] Tables simultanees → affichage cote a cote
- [ ] Drag sur mobile (long-press) → fonctionne
- [ ] Autre client voit le drag en temps reel

---

## Dependances a ajouter

```json
"@fullcalendar/react": "^6.1.x",
"@fullcalendar/timegrid": "^6.1.x",
"@fullcalendar/interaction": "^6.1.x"
```

Note : FullCalendar v6 necessite aussi `@fullcalendar/core` (installe automatiquement
comme peer dependency).

---

## Donnees manquantes dans `PlanningTab`

Actuellement `PlanningTab` ne connait pas les dates de l'event (necessaires pour `validRange`
et calcul du nombre de jours). Il faudra soit :
- **Option A** : passer `event` en prop depuis `EventDetailPage` / `PlanningPage`
- **Option B** : faire un fetch `GET /api/events/:eventId` au montage de `PlanningTab`

Option B recommandee : `PlanningTab` est autonome et peut l'appeler independamment.
Le cache HTTP (304 Not Modified) evite le surcoût.

---

## Plan d'implementation (phases)

### Phase 1 — Setup & affichage read-only (sans drag)
1. Installer les deps FullCalendar
2. Creer `CalendarView.tsx` : afficher les tables comme blocs, color coding, bloc custom
3. Ajouter le toggle dans `PlanningTab`, fetch des dates de l'event
4. Tester l'affichage multi-jours, simultanee, scroll auto

### Phase 2 — Drag & drop
5. Activer `editable`, gerer `eventDrop` + appel PATCH
6. Optimistic update + revert sur erreur
7. `validRange` pour bloquer hors-event

### Phase 3 — Resize
8. Activer `eventResizableFromStart: false`, gerer `eventResize`
9. Poignee visible sur mobile

### Phase 4 — Polish
10. Warning chevauchement
11. Mobile : navigation jour par jour, swipe
12. Persistence localStorage du toggle
13. Surcharge CSS pour matcher le theme DaisyUI
14. Tests unitaires + mise a jour `MANUAL_TESTING.md`
