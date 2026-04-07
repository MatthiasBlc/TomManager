# RESUME - Prochaine session

### Rediger les tests frontend (priorite)

Le protocole de test est en place (vitest + testing-library, lint propre, 1 exemple de test).
Il faut maintenant rediger les tests phase par phase selon la roadmap :
`docs/features/frontend-tests/ROADMAP.md`

Phases 1 a 8. Apres chaque phase : tests verts, lint parfait, commit.

### Une fois tout ce qui est ci-dessus terminé complètement et proprement :

il faudrait modifier la CI / les variables de docker compose pour que la prod et la preprod ne pointent pas sur le même bot discord

ce qui veut dire à minima avoir des :
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_GUILD_ID
DISCORD_BOT_TOKEN
DISCORD_ADMIN_ROLE_ID

différents pour la prod et la preprod
