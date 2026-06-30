-- Places reservees par le MJ sur une table
ALTER TABLE "GameTable" ADD COLUMN "reservedSeats" INTEGER NOT NULL DEFAULT 0;

-- Tracking si un participant occupe une place reservee
ALTER TABLE "GameTableParticipant" ADD COLUMN "isOnReservedSeat" BOOLEAN NOT NULL DEFAULT false;

-- Nouveau type de notification pour l'affectation a une place reservee
ALTER TYPE "NotificationType" ADD VALUE 'RESERVED_SEAT_ASSIGNED';
