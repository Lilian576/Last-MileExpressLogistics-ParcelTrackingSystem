ALTER TABLE "parcels"
ADD COLUMN "driver_latitude" DECIMAL(65,30),
ADD COLUMN "driver_longitude" DECIMAL(65,30),
ADD COLUMN "driver_location_at" TIMESTAMP(3);
