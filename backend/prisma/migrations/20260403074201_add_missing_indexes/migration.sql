-- CreateIndex
CREATE INDEX "Event_createdBy_idx" ON "Event"("createdBy");

-- CreateIndex
CREATE INDEX "EventParticipation_eventId_idx" ON "EventParticipation"("eventId");

-- CreateIndex
CREATE INDEX "GameTableParticipant_userId_idx" ON "GameTableParticipant"("userId");
