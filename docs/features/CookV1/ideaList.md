Nouvelle feature Tom manager (cuisine) :

le but de cette feature est de pouvoir avoir un outil de gestion pour l'oganisation des repas

Rôles :

- Responsable cuisine = un ou plusieurs admin, je propose une option à cocher pour activer le mode "gestion cuisine" dans le profil utilisateur des admins.
- Chefs = les personnes qui vont les recettes. Ce sont des utilisateurs (admin ou classiques) soit : avec un rôle spécifique sur le discord associé (utiliser l'id pour relier automatiquement), soit sélectionnés manuellement par les responsables cuisine.
- Les équipiers : chaque personne qui va aider un chef pour un repas spécifique. Ce sont tout les autres participants sur l'évènement.

Pouvoirs :
un chef est responsable de tout ce qui touche à son repas (lecture écriture), a accès en lecture à ce que fait les autres chefs.
les admins ont toujours accès en lecture aux parties cuisine.
Les responsable cuisne ont accès en lecture et écriture à toutes les parties cuisine.
Les équipiers n'ont que des accès limités.

Vues :
Gestion responsable cuisne :

- Définir l'id du rôle discord associé aux chefs (si vide, pas de rôle discord)
- Liste des chefs (+ si pas de rôle discord, des boutons doivent apparaitre pour pouvoir ajouter et retirer des chefs manuellement)
- Lister les allergies des utilisateurs
- Activer/désactiver la vue des plannings cuisine pour les équipiers.

Fiches repas (doit être créé par les chefs):

- Nom du repas
- Le chef (responsable du repas)
- Date + plage horaire (midi / soir + prévoir l'heure de début et de fin, une équipe de repas peut commencer à 10h là ou pour une autre 11h00 pourrait suffire)
- Visualisation des allergies (rappel)
- Liste des ingrédients + quantités
- Liste d'ustensiles spécifiques nécessaires

Planning cuisine / inscription (doit être visible par tous à partir du moment ou c'est activé par le responsable cuisine):
Ce planning est un planning simple : chaque créneau a une heure de début et de fin, et peut être réservé par un équipier. Il y a un nombre maximum d'équipier par repas (A la génération, le nombre doit être équivallent entre chaque repas si possible. le pool d'équipier est celui des participants de l'évènement - les chefs et l'équipe couses. Pour l'instant le responsable cuisine doit avoir un champ libre dans lequel il peut paramétrer le nombre de personnes dans l'équipe courses pour le calcul.). Le responsable cuisine peut tout à fait modifier le planning après la génération (modifier le nombre max d'équipier par repas)
Les équipiers doivent pouvoir se positionner sur un des crénaux du tableau.
Cette vue a donc :

- Visualisation planning avec chef + intitulé recette
- voir les équipiers inscrits et les places restantes.
- pouvoir s'inscrire ou se déplacer si l'on est déjà inscrit ailleurs et qu'il y a de la place sur la destination

Dans les vues planning de l'évènement, les créneaux cuisine doivent être visibles. les règles de conflits (une personen ne peut pas être sur deux tables en même temps, surbrillance conflit) s'appliquent entre crénaux cuisines et tables de jeux. Les personnes concernées doivent voir la surbrillance, ainsi que les chefs et les organisateurs de parties concernées.

Dans un second temps, nous ajouterons un module de gestion des courses. Il faut prévoir que les ingrédients des repas puissent être ajoutés à la liste de course.
