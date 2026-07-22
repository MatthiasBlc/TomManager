Revoir l'interface admin + responsablecuisine

---

7/ est-ce que le bouton de génération des créneaux de repas est vraiment nécessaire( et son pendant de suppression aussi par la même occasion) ? (admin cuisine) Ou n'est-ce pas plus logique que ça soit automatique (puisque les créneaux sont automatique) + purgé du content avec la purge event ?


8/ Dans info, ajouter une catégorie "mon planning" avec la liste des parties sur lesquelles je suis inscrits (en tant que MJ et joueur)
---

système de notif cuisine

- lister toutes les notifs à mettre en place
- mettre en place ces notifs

V2 ?
-Liste de course ?

- _Récupère les occurrences d'un même produits et calcules le poids pour chaque produits_

Allergies V2 :
Ajouter un champ directement à l'utilisateur pour indiquer ses allergies.
Reporter automatiquement la liste

-------------INFO test seed---------------
"Fonctionne uniquement en local avec la base seedée

Le plus rapide sans toucher au code : ouvre http://localhost:3000, ouvre la console du navigateur (F12) et colle ceci pour te connecter avec un des comptes seedés :

fetch("http://localhost:3001/api/auth/login", {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ identifier: "admin@local.dev", password: "admin123" }),
}).then(() => location.href = "/events");

Remplace juste identifier/password pour changer de compte (adminchef@local.dev/admin123, chef@local.dev/chef123, user@local.dev/user123). Le cookie de session est posé sur localhost donc il fonctionne normalement ensuite dans l'appli sur le port 3000.
------------------ADMINCHEF---------------------
fetch("http://localhost:3001/api/auth/login", {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ identifier: "adminchef@local.dev", password: "admin123" }),
}).then(() => location.href = "/events");
------------------CHEF---------------------
fetch("http://localhost:3001/api/auth/login", {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ identifier: "chef@local.dev", password: "chef123" }),
}).then(() => location.href = "/events");
------------------USER---------------------
fetch("http://localhost:3001/api/auth/login", {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ identifier: "user@local.dev", password: "user123" }),
}).then(() => location.href = "/events");
