# RESUME - Prochaine session


### Une fois tout ce qui est ci-dessus terminé complètement et proprement :

il faudrait modifier la CI / les variables de docker compose pour que la prod et la preprod ne pointent pas sur le même bot discord

ce qui veut dire à minima avoir des :
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_GUILD_ID
DISCORD_BOT_TOKEN
DISCORD_ADMIN_ROLE_ID

différents pour la prod et la preprod
