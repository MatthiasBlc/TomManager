Admin Chef — IMPLEMENTE (voir SPEC_COOKING.md section "Onglet Cuisine" / section gestion,
et section 9 pour l'API) :

1/ Bouton "Generer le planning" -> "Reinitialiser le planning" en toggle selon
   `meals.length` (`POST /reset`, nouveau, garde les rosters).
2/ Toggle Generer/Reinitialiser exclusif (jamais les deux boutons ensemble).
3/ Creation manuelle de repas retiree (front + back + tests).
4/ Compteur "equipiers repartis" (`capacitySummary: { allocated, poolTotal }`) au
   niveau du bloc Planning.
5/ Fiches repas en liste (creneau non-editable, chef/capacite/equipiers actionnables
   sur la ligne, modale "details"/"modifier"/"valider" pour nom+ingredients+ustensiles,
   creneau non supprimable).
6/ Seed etoffe (grille complete 9 creneaux, orphelins, LUNCH, repas complet/sur-occupe/
   minimal, equipe courses peuplee).
