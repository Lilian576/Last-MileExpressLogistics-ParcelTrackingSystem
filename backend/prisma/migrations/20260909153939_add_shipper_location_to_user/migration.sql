-- AlterTable
ALTER TABLE "users" ADD COLUMN     "current_latitude" DECIMAL(65,30),
ADD COLUMN     "current_longitude" DECIMAL(65,30),
ADD COLUMN     "location_updated_at" TIMESTAMP(3);
