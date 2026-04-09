# ROADMAP : Upgrade Tailwind v4 + DaisyUI v5 + Theme ToM

## Statut : A faire (branche dédiée)

---

## Etape 1 - Mise a jour des dependances

- [ ] `npm install tailwindcss@^4 @tailwindcss/vite@^4`
- [ ] `npm install daisyui@^5`
- [ ] Supprimer `tailwindcss` de `postcss.config.js` (remplace par le plugin Vite)

## Etape 2 - Migration vite.config.ts

- [ ] Remplacer le plugin PostCSS Tailwind par `@tailwindcss/vite`

```ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

## Etape 3 - Supprimer tailwind.config.js

- [ ] Supprimer `frontend/tailwind.config.js`
- [ ] Migrer les keyframes / animations custom vers `@theme` dans `index.css`
- [ ] Migrer les variants custom (`pointer-fine`, `pointer-coarse`) vers `@variant` dans `index.css`

## Etape 4 - Migration index.css

- [ ] Remplacer les 3 directives `@tailwind` par `@import "tailwindcss"`
- [ ] Ajouter `@plugin "daisyui"` (remplace `require("daisyui")` du config)
- [ ] Ajouter le bloc `@plugin "daisyui/theme"` avec le theme ToM exact (cf. spec)
- [ ] Migrer les variables CSS FullCalendar : `hsl(var(--b1))` -> `oklch(var(--color-base-100))` etc.

  | Ancien      | Nouveau                     |
  | ----------- | --------------------------- |
  | `var(--b1)` | `var(--color-base-100)`     |
  | `var(--b2)` | `var(--color-base-200)`     |
  | `var(--b3)` | `var(--color-base-300)`     |
  | `var(--bc)` | `var(--color-base-content)` |
  | `var(--er)` | `var(--color-error)`        |

## Etape 5 - Audit classes composants

- [ ] Scanner les usages `bg-opacity-*`, `text-opacity-*` -> syntaxe slash (`bg-*/50`)
- [ ] Verifier les classes DaisyUI renommees entre v4 et v5 (consulter changelog DaisyUI v5)
- [ ] Tester visuellement chaque page : Home, Planning, BoardGames, Profile

## Etape 6 - Validation

- [ ] `npm run docker:up:build` -> build sans erreur
- [ ] `npm test` -> tous les tests passent
- [ ] Review visuelle avec `data-theme="ToM"` et `data-theme="winter"`
- [ ] Verifier le toggle dark/light sur ProfilePage

---

## Notes

- Branche suggeree : `feature/upgrade-tailwind-daisyui-v5`
- Pas de changement backend
- Risque principal : classes CSS silencieusement cassees (pas d'erreur compile, regression visuelle)
- Recommandation : commencer par l'etape 1-4 en verifiant le build, puis etape 5 en mode review visuelle
