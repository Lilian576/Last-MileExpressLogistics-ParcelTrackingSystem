ALTER TABLE "parcels"
ADD COLUMN "fee" INTEGER,
ADD COLUMN "sender_lat" DECIMAL(65,30),
ADD COLUMN "sender_lng" DECIMAL(65,30),
ADD COLUMN "receiver_lat" DECIMAL(65,30),
ADD COLUMN "receiver_lng" DECIMAL(65,30),
ADD COLUMN "delivery_proof_ref" TEXT,
ADD COLUMN "driver_latitude" DECIMAL(65,30),
ADD COLUMN "driver_longitude" DECIMAL(65,30),
ADD COLUMN "driver_location_at" TIMESTAMP(3);
