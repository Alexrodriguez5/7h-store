-- BUG-03: clave de intento de compra. Aditiva: dos columnas opcionales y un índice único.
-- Los pedidos existentes quedan con NULL (PostgreSQL permite varios NULL en un índice único).
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyHash" TEXT;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
