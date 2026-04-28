# Changelog utilisateur — 2026-04-28

## Branche : UpdateTTSSystem (jds-rework)

---

🎲 **Jeux de societe : liaison avec les tables**

Les tables de jeu peuvent desormais etre associees a un jeu de la banque de jeux. Le titre de la table se remplit automatiquement depuis le jeu selectionne, et le type de partie (RPG / Jeu de societe) est detecte automatiquement.

---

📖 **Fiche detail d'un jeu enrichie**

La modale de detail d'un jeu affiche maintenant la couverture, la description, les joueurs min/max, la duree et la complexite. Ces informations sont tirees directement de la banque de jeux BoardGameGeek.

---

🛠️ **Banque de jeux : gestion admin**

Les admins peuvent acceder a la banque de jeux globale depuis les options avancees d'un evenement. Il est possible de consulter, modifier et fusionner les entrees en doublon directement depuis cette interface.

---

🔀 **Fusion de jeux avec selection par champ**

Lors de la fusion de deux jeux en doublon, il est maintenant possible de choisir champ par champ quelle version conserver (titre, image, description...). Plus besoin de tout ecraser d'un coup.

---

🔧 **Corrections**

- La barre de navigation reste visible en haut de page lors du defilement sur desktop
- L'affichage du calendrier ne genere plus de barre de defilement parasite sur desktop
- Les boutons Modifier / Supprimer d'un evenement sont plus compacts et le bouton "Banque de jeux" est maintenant bien visible
