-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'shipper', 'warehouse_staff', 'admin');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('CREATED', 'PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNING', 'RETURNED', 'CANCELLED', 'LOST');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('warehouse', 'hub', 'delivery_point', 'sender_address');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('pickup', 'last_mile', 'hub_transfer');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('assigned', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'customer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" TEXT NOT NULL,
    "tracking_code" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_name" TEXT NOT NULL,
    "receiver_phone" TEXT NOT NULL,
    "receiver_address" TEXT NOT NULL,
    "weight_kg" DECIMAL(65,30) NOT NULL,
    "dimensions" TEXT,
    "cod_amount" DECIMAL(65,30),
    "current_status" "ParcelStatus" NOT NULL DEFAULT 'CREATED',
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "origin_location_id" TEXT,
    "destination_location_id" TEXT,
    "current_location_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_status_history" (
    "id" TEXT NOT NULL,
    "parcel_id" TEXT NOT NULL,
    "status" "ParcelStatus" NOT NULL,
    "location_id" TEXT,
    "changed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "parent_location_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" TEXT NOT NULL,
    "parcel_id" TEXT NOT NULL,
    "courier_id" TEXT NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'assigned',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_tracking_code_key" ON "parcels"("tracking_code");

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_origin_location_id_fkey" FOREIGN KEY ("origin_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_status_history" ADD CONSTRAINT "parcel_status_history_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_status_history" ADD CONSTRAINT "parcel_status_history_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_status_history" ADD CONSTRAINT "parcel_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_fkey" FOREIGN KEY ("parent_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
