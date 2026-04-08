# RESUME - Prochaine session

### Optionnel : remplacer axios par un wrapper fetch custom

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
