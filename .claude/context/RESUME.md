# RESUME - Prochaine session

### Tests frontend - reprendre a la phase 8

Phases 1 a 7 completes (138 tests verts, lint propre).
Reste la phase 8 (Pages) selon `docs/features/frontend-tests/ROADMAP.md` :
NotFoundPage, HomePage, LoginPage (deja partiellement teste en phase 6), ProfilePage,
EventListPage, EventDetailPage, TableDetailPage.

Apres la phase : tests verts, lint parfait, commit `test: phase 8 - pages`.

### Une fois tout ce qui est ci-dessus terminé complètement et proprement :

il faudrait modifier la CI / les variables de docker compose pour que la prod et la preprod ne pointent pas sur le même bot discord

ce qui veut dire à minima avoir des :
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_GUILD_ID
DISCORD_BOT_TOKEN
DISCORD_ADMIN_ROLE_ID

différents pour la prod et la preprod
