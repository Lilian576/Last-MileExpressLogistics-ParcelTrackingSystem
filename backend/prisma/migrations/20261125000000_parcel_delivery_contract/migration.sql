-- Existing rows intentionally keep NULL for unknown fees, coordinates and proof.
ALTER TABLE "parcels"
  ADD COLUMN "fee_vnd" INTEGER,
  ADD COLUMN "sender_lat" DECIMAL(9,6),
  ADD COLUMN "sender_lng" DECIMAL(9,6),
  ADD COLUMN "receiver_lat" DECIMAL(9,6),
  ADD COLUMN "receiver_lng" DECIMAL(9,6),
  ADD COLUMN "delivery_proof" TEXT,
  ADD COLUMN "delivered_at" TIMESTAMP(3);
