# RESUME - Prochaine session

### Optionnel (apres phase 8) : supprimer @sentry/react si inutilisé

**Modele reco : Haiku 4.5 | Effort : 15min**

**Context** : Sentry est importé dans `src/main.tsx` mais activé seulement si `VITE_SENTRY_DSN` est défini
(variable d'env). Si tu ne l'utilises pas (pas de DSN configuré en prod), c'est une dépendance morte.

**Check préalable** :

- Vérifier si `VITE_SENTRY_DSN` est défini quelque part (CI env, .env.production, etc.)
- Si non utilisé : supprimer est trivial

**Refacto proposée** (si inutilisé) :

1. Supprimer `@sentry/react` du `package.json`
2. Supprimer les 8 lignes Sentry du `src/main.tsx`
3. Garder la structure app intacte

**Avantages** : une grosse dépendance de moins (Sentry est lourd), plus léger à déployer.
**Effort** : ~15 min (trivial, si vraiment inutilisé).

### Une fois tout ce qui est ci-dessus terminé complètement et proprement :

**Modele reco : Sonnet 4.6 | Effort : 2-3h**

il faudrait modifier la CI / les variables de docker compose pour que la prod et la preprod ne pointent pas sur le même bot discord

ce qui veut dire à minima avoir des :
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_GUILD_ID
DISCORD_BOT_TOKEN
DISCORD_ADMIN_ROLE_ID

différents pour la prod et la preprod

### Optionnel (apres phase 8) : remplacer axios par un wrapper fetch custom

**Modele reco : Sonnet 4.6 | Effort : 2h**

**Context** : Le projet utilise axios (`src/config/api.ts`) pour les requêtes HTTP.
Axios apporte surtout de la convenance (timeouts, intercepteurs, etc.), mais fetch moderne
peut faire 95% des mêmes choses sans dépendance externe.

**Refacto proposée** :

1. Creer un wrapper fetch minimaliste (30 lignes) avec les mêmes méthodes : `get()`, `post()`, `delete()`, `put()`
2. Garder `src/config/api.ts` comme point d'entrée (même interface)
3. Ajouter une couche d'intercepteurs auth au niveau du Provider React si besoin
4. Supprimer `axios` de `package.json`
5. Tests existants resteront valides (les mocks de `../config/api` restent identiques)

**Avantages** : une dépendance de moins, moins de surface d'attaque, code plus clair.
**Effort** : ~2h refacto + vérifier l'app au complet (pas de breaking change esperé).

### Optionnel (futur) : étudier le remplacement de @fullcalendar par une solution custom

**Modele reco : Opus 4.6 | Effort : 4-6h**

**Context** : FullCalendar est une dépendance lourde utilisée dans CalendarView/PlanningTab.
Le projet ne l'exploite qu'à 10% : affichage d'une timeline simple d'événements.
Un composant React custom + CSS grid pourrait faire la même chose avec beaucoup moins de poids.

**Avant de commencer** :

- Créer une branche dédiée (`feature/custom-calendar` ou similaire)
- Documenter **exactement** ce que FullCalendar fait actuellement (render, interactions, drag-drop, etc.)
- Vérifier les tests e2e (`docs/MANUAL_TESTING.md` ou tests Playwright)

**Critères de validation** (avant merge) :

- ✓ Affichage identique (même layout, même style, même responsivité)
- ✓ Toutes les interactions fonctionnent (click, navigation, sélection de slots)
- ✓ Aucune perte de feature (agenda view, time grid, filtering, etc.)
- ✓ Tests e2e passent
- ✓ Aucune régression sur les pages qui l'utilisent

**Effort estimé** : ~4-6h (exploration + impl + tests). À faire **seulement** si vraiment nécessaire.
**Risque** : refacto complexe, facile de casser quelque chose. Valider en tests avant le moindre commit final.
