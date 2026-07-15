:abacus: **Comptage des places reservees fiabilise**

Le nombre de places reservees d'une table est desormais un total fixe, defini par le MJ, qui ne bouge plus au gre des arrivees et departs de joueurs.
Fini les compteurs faux (comme "0/1 place libre" alors que tout etait occupe) et les joueurs renvoyes en liste d'attente sans raison apres une simple modification de la table.
Les tables existantes ont ete corrigees automatiquement.

---

:crown: **La place du MJ est protegee**

Le MJ ne peut plus perdre sa place sur sa propre table : impossible de le retrograder, de le retirer ou de reduire la table au point de l'ejecter.
Sur une table JDR, cocher "MJ joueur" lui cree automatiquement une place dediee (et la decocher la retire), sans jamais leser les joueurs deja installes.
Un petit indicateur sous la case explique l'effet sur le nombre de places.

---

:fr: **Accents retablis dans l'interface**

Les textes de l'application affichent de nouveau les accents francais corrects : "Evenements" devient "Événements", "Places reservees" devient "Places réservées", etc.
L'interface est plus agreable et plus naturelle a lire.

---

:wrench: Corrections

- Un joueur retrograde en liste d'attente repart en fin de file au lieu de doubler tout le monde
- La conversion d'une place reservee en place libre est bloquee quand il n'y a plus de place libre disponible, pour eviter les tables en sureffectif
- Plus de risque de surreservation quand plusieurs joueurs cliquent en meme temps sur la derniere place
- Plus de double notification quand un joueur est retrograde suite a une modification de la table
