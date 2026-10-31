CREATE TABLE "ProcessedEvent" (
  "eventId" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")
);
CREATE TABLE "Notification" (
  "eventId" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("eventId")
);
