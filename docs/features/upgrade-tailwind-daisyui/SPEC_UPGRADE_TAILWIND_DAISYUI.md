# SPEC : Upgrade Tailwind v3 -> v4 + DaisyUI v4 -> v5 + Theme ToM

## Objectif

Migrer le frontend vers Tailwind CSS v4 et DaisyUI v5 pour pouvoir appliquer
le theme personnalise "ToM" via la syntaxe native `@plugin "daisyui/theme"`.

## Contexte

| Package           | Actuel   | Cible     |
| ----------------- | -------- | --------- |
| tailwindcss       | ^3.4.17  | ^4.x      |
| daisyui           | ^4.12.23 | ^5.x      |
| postcss           | ^8.5.1   | ^8.x (OK) |
| @tailwindcss/vite | absent   | ^4.x      |

## Breaking changes majeurs

### Tailwind v3 -> v4

- `tailwind.config.js` est **supprime** : la config migre dans `index.css` via `@import "tailwindcss"`
- Les directives `@tailwind base/components/utilities` sont remplacees par `@import "tailwindcss"`
- Le plugin Vite remplace `postcss-tailwindcss` : `@tailwindcss/vite` dans `vite.config.ts`
- Les classes de couleurs changent de syntaxe (`bg-opacity-*` -> `bg-*/50`, etc.)
- Les variantes `dark:` fonctionnent toujours mais via `color-scheme`
- Les plugins Tailwind (custom variants pointer-fine/coarse) migrent vers `@variant` dans le CSS

### DaisyUI v4 -> v5

- Les themes ne sont plus declares dans `tailwind.config.js` (`daisyui.themes`)
- La declaration se fait via `@plugin "daisyui/theme" { ... }` dans le CSS
- `require("daisyui")` disparait du config -> `@plugin "daisyui"` dans le CSS
- Les variables CSS changent de format : `hsl(var(--b1))` -> `oklch(var(--color-base-100))`
  (impact sur les styles FullCalendar dans `index.css`)

## Theme ToM (cible exacte)

```css
@plugin "daisyui/theme" {
  name: "ToM";
  default: false;
  prefersdark: false;
  color-scheme: "dark";
  --color-base-100: oklch(25.7% 0 0);
  --color-base-200: oklch(22.648% 0 0);
  --color-base-300: oklch(20.944% 0 0);
  --color-base-content: oklch(84.87% 0 0);
  --color-primary: oklch(74.722% 0.072 131.116);
  --color-primary-content: oklch(13.454% 0.033 35.791);
  --color-secondary: oklch(86.19% 0.047 102.15);
  --color-secondary-content: oklch(12.818% 0.005 229.389);
  --color-accent: oklch(79% 0.076 298.3);
  --color-accent-content: oklch(13.454% 0.033 35.791);
  --color-neutral: oklch(30.1% 0 253.041);
  --color-neutral-content: oklch(85.5% 0 253.041);
  --color-info: oklch(86.19% 0.047 224.14);
  --color-info-content: oklch(12.523% 0.028 240.033);
  --color-success: oklch(74.722% 0.072 131.116);
  --color-success-content: oklch(14.045% 0.018 156.596);
  --color-warning: oklch(88.15% 0.14 87.722);
  --color-warning-content: oklch(15.496% 0.023 81.519);
  --color-error: oklch(65.72% 0.199 27.33);
  --color-error-content: oklch(12.523% 0.028 240.033);
  --radius-selector: 2rem;
  --radius-field: 1rem;
  --radius-box: 1rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

## Perimetre

- `frontend/` uniquement (backend non concerne)
- Fichiers impactes :
  - `package.json` (deps)
  - `vite.config.ts` (plugin Tailwind v4)
  - `postcss.config.js` (supprimer tailwindcss, garder autoprefixer)
  - `tailwind.config.js` -> supprime
  - `src/styles/index.css` (migration complete)
  - `src/hooks/useTheme.ts` (DARK_THEME = "ToM" - deja fait)
  - Audit classes CSS dans tous les composants (breaking changes couleurs)

## Hors perimetre

- Migration des tests (Vitest non impacte directement)
- Changement de design / palette (le theme ToM reproduit visuellement le coffee actuel)

## Recommandation

**Modele** : Sonnet 4.6 | **Effort** : 3-5h (complex - nombreux fichiers, risque de regression visuelle)
