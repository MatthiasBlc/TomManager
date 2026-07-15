---
description: Redige le prochain changelog utilisateur (docs/changelogs/) a partir des commits de la branche courante
---

Redige un nouveau changelog utilisateur en suivant la regle "changelog utilisateur" de `.claude/CLAUDE.md`.

## Etapes

1. Lister les fichiers de `docs/changelogs/`, les trier par nom (tri chronologique) et identifier le plus recent.
2. Recuperer les commits de la branche courante depuis ce dernier changelog. Pour cela :
   - Si le changelog le plus recent correspond a une branche encore visible dans l'historique, utiliser son point de depart comme reference.
   - Sinon, comparer avec `master` (`git log master..HEAD` ou equivalent) pour lister tous les commits de la branche courante non encore documentes.
3. Lire les commits (messages + diffs si necessaire) pour comprendre les changements du point de vue utilisateur : nouvelles fonctionnalites, ameliorations visibles, corrections de bugs. Ignorer le pur travail technique invisible pour l'utilisateur (refacto interne, tests, tooling, doc dev) sauf s'il a un impact utilisateur indirect notable (perf, fiabilite, securite).
4. Rediger `docs/changelogs/YYYY-MM-DD_nom-branche.md` (date du jour, nom de branche nettoye en kebab-case sans prefixe `feature/`/`fix/`) en respectant STRICTEMENT le format suivant :
   - Une section par fonctionnalite/amelioration notable :
     ```
     :emoji-shortcode: **Titre de la feature**

     Description en 2-3 phrases orientees utilisateur, ton simple et positif.
     ```
   - Sections separees par une ligne `---`
   - Corrections mineures groupees en fin de fichier sous `:wrench: Corrections` en liste a puces
   - Emoji en shortcode (`:book:`, `:tools:`, `:wrench:`, `:twisted_rightwards_arrows:`, etc.), jamais d'emoji Unicode brut
   - Titre de chaque section en **gras**
   - Pas de jargon technique, pas d'accents (ASCII only) — coherent avec les changelogs existants
   - Ton : oriente utilisateur non-technique, simple et positif, SANS minimiser ni invisibiliser le travail effectue (une fonctionnalite consequente merite une description qui reflete son ampleur, pas juste "petite amelioration")
   - Pas de titre de fichier ni de ligne "Branche : ..." en tete (les changelogs recents n'en ont plus, contrairement aux tres anciens) — la premiere ligne du fichier est directement la premiere section
5. Afficher le contenu integral du fichier redige dans la reponse pour validation par l'utilisateur avant de considerer la tache terminee.

Ne pas committer le fichier automatiquement — laisser l'utilisateur valider le contenu d'abord.
