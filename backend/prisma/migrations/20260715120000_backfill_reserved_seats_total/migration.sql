-- Migration de donnees (pas de changement de schema).
--
-- Le champ GameTable.reservedSeats change de sens dans le code applicatif :
-- il passait pour un "pool restant non attribue", decremente/incremente par
-- les actions participants (join/promote/demote/leave/kick). Il devient un
-- "total fixe" configure par le MJ, uniquement modifie via l'edition de la
-- table ; le nombre de places reservees encore disponibles se derive desormais
-- a la volee (reservedSeats - places reservees occupees).
--
-- Consequence : pour toute table ayant deja des places reservees attribuees
-- au moment du deploiement, la valeur stockee est DEJA decrementee par
-- l'ancien code. Sans backfill, elle serait interpretee a tort comme le
-- nouveau total (ex: table configuree a 2 places reservees, 1 deja
-- attribuee -> stockee a 1 -> lue comme "total = 1" apres deploiement au
-- lieu de "total = 2, 1 occupee, 1 disponible").
--
-- On restaure le vrai total configure par le MJ en rajoutant le nombre de
-- places reservees actuellement occupees (participants CONFIRMED sur une
-- place reservee) a la valeur stockee.
UPDATE "GameTable" AS gt
SET "reservedSeats" = gt."reservedSeats" + sub.cnt
FROM (
  SELECT "gameTableId", COUNT(*)::int AS cnt
  FROM "GameTableParticipant"
  WHERE status = 'CONFIRMED' AND "isOnReservedSeat" = true
  GROUP BY "gameTableId"
) AS sub
WHERE gt.id = sub."gameTableId";
