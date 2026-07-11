-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('MONTHLY', 'YEARLY', 'FOUNDING', 'MANUAL');

-- CreateEnum
CREATE TYPE "MembershipOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AlbumRarity" AS ENUM ('N', 'R', 'SR', 'SSR', 'UR');

-- CreateEnum
CREATE TYPE "AlbumSource" AS ENUM ('CATALOG', 'USER_CREATED');

-- CreateEnum
CREATE TYPE "TvDeviceStatus" AS ENUM ('BOUND', 'UNBOUND', 'DISABLED');

-- CreateEnum
CREATE TYPE "SyncEventType" AS ENUM ('BOUND', 'UNBOUND', 'SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'OPERATOR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wechat_open_id" VARCHAR(128) NOT NULL,
    "display_name" VARCHAR(64) NOT NULL,
    "avatar_url" TEXT,
    "registration_sequence" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "plan" "MembershipPlan" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_order_number" VARCHAR(64) NOT NULL,
    "wechat_transaction_id" VARCHAR(64),
    "plan" "MembershipPlan" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "MembershipOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "membership_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "artist" VARCHAR(160) NOT NULL,
    "release_year" INTEGER,
    "genre" VARCHAR(80),
    "cover_url" TEXT,
    "rarity" "AlbumRarity" NOT NULL DEFAULT 'N',
    "source" "AlbumSource" NOT NULL DEFAULT 'CATALOG',
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_tracks" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,

    CONSTRAINT "album_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "purchase_price_cents" INTEGER,
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tv_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "device_key_hash" VARCHAR(128) NOT NULL,
    "status" "TvDeviceStatus" NOT NULL DEFAULT 'BOUND',
    "last_synced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tv_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tv_device_id" TEXT,
    "type" "SyncEventType" NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_id" VARCHAR(128),
    "action" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "memberships"
ADD CONSTRAINT "memberships_valid_period_check"
CHECK ("expires_at" > "starts_at");

ALTER TABLE "membership_orders"
ADD CONSTRAINT "membership_orders_amount_check"
CHECK ("amount_cents" >= 0);

ALTER TABLE "membership_orders"
ADD CONSTRAINT "membership_orders_commercial_plan_check"
CHECK ("plan" IN ('MONTHLY', 'YEARLY'));

ALTER TABLE "membership_orders"
ADD CONSTRAINT "membership_orders_paid_fields_check"
CHECK (
    "status" <> 'PAID'
    OR ("paid_at" IS NOT NULL AND "wechat_transaction_id" IS NOT NULL)
);

ALTER TABLE "albums"
ADD CONSTRAINT "albums_release_year_check"
CHECK ("release_year" IS NULL OR "release_year" BETWEEN 1800 AND 3000);

ALTER TABLE "album_tracks"
ADD CONSTRAINT "album_tracks_position_check"
CHECK ("position" > 0);

ALTER TABLE "collections"
ADD CONSTRAINT "collections_purchase_price_check"
CHECK ("purchase_price_cents" IS NULL OR "purchase_price_cents" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "users_wechat_open_id_key" ON "users"("wechat_open_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_registration_sequence_key" ON "users"("registration_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_order_id_key" ON "memberships"("order_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_expires_at_idx" ON "memberships"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_merchant_order_number_key" ON "membership_orders"("merchant_order_number");

-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_wechat_transaction_id_key" ON "membership_orders"("wechat_transaction_id");

-- CreateIndex
CREATE INDEX "membership_orders_user_id_created_at_idx" ON "membership_orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "membership_orders_status_created_at_idx" ON "membership_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "albums_artist_release_year_idx" ON "albums"("artist", "release_year");

-- CreateIndex
CREATE INDEX "albums_title_idx" ON "albums"("title");

-- CreateIndex
CREATE INDEX "albums_genre_idx" ON "albums"("genre");

-- CreateIndex
CREATE UNIQUE INDEX "album_tracks_album_id_position_key" ON "album_tracks"("album_id", "position");

-- CreateIndex
CREATE INDEX "collections_user_id_collected_at_idx" ON "collections"("user_id", "collected_at");

-- CreateIndex
CREATE UNIQUE INDEX "collections_user_id_album_id_key" ON "collections"("user_id", "album_id");

-- CreateIndex
CREATE UNIQUE INDEX "tv_devices_device_key_hash_key" ON "tv_devices"("device_key_hash");

-- CreateIndex
CREATE INDEX "tv_devices_user_id_status_idx" ON "tv_devices"("user_id", "status");

-- CreateIndex
CREATE INDEX "sync_events_user_id_created_at_idx" ON "sync_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_events_tv_device_id_created_at_idx" ON "sync_events"("tv_device_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "membership_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_tracks" ADD CONSTRAINT "album_tracks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tv_devices" ADD CONSTRAINT "tv_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_tv_device_id_fkey" FOREIGN KEY ("tv_device_id") REFERENCES "tv_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
