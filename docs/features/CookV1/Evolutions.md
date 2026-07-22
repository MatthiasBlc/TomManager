Admin Chef :

1/ Bouton générer le planning, Fonctionne une fois. Disparait une fois qu'il a été utilisé (en attente du reset event ou d'un reset planning.)
2/ Lorsque le bouton est en cooldown, il doit être remplacé par le bouton de reset du planning cuisine.
3/ Retrait du bouton "créer un repas manuellement" et du code associé.
4/ Il doit avoir au niveau du bloc "planning" le nombre total d'équipier (total participants - chefs - team course) et le nombre de slot(capacité) qui ont été réparti entre tout les repas. Exemple s'il y a 12 équipiers au total et 4 repas, que sur le premier il y a max 3 places, sur le deuxième 2 places, sur le troisième 4 places et que sur le quatrième 1 places, y avoir 10/12, ce qui veut dire qu'il peut monter n'importe laquelle de ces valeurs de +2 max.
5/ fiches repas : doit voir les repas en mode liste, il doit y voir le créneau, si ce dernier est libre ou pris, le nom du plat (sil y en a un), le nom du chef (s'il y en a un, sinon il doit pouvoir choisir un chef à assigner parmis ceux qui ne sont pas encore sur un créneau), le nom des équipiers assignés (s'il y en a, sinon il doit pouvoir chercher parmi les disponibles pour les assigner sur ce créneau si et seulement si il reste des place vide).
Il doit cliquer sur une des fiche en question pour voir la modale "détails" de cette dernière. Il ne doit être qu'en lecture jusqu'au moment ou il clique sur "modifier" dans la modale, alors il arrive à une modification de la fiche avec une validation (qui sert à fermer la modale)
Une fiche repas ne doit pas avoir de champ visible jour, de champ début, de champ fin. Pour la capacité il doit avoir un nombre X/Y (X = nombre de place déjà prise, Y = nombre de place total) et un sélecteur pour choisir le nombre de places max (s'il en reste de dispo). Il ne peut pas supprimer un créneau une fois généré.

Update le Seed afin d'avoir des données de test un peu partout sur la partie cuisine.
