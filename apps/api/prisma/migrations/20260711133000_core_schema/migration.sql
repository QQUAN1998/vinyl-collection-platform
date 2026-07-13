-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `wechat_open_id` VARCHAR(128) NOT NULL,
    `display_name` VARCHAR(64) NOT NULL,
    `avatar_url` TEXT NULL,
    `registration_sequence` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_wechat_open_id_key`(`wechat_open_id`),
    UNIQUE INDEX `users_registration_sequence_key`(`registration_sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memberships` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NULL,
    `plan` ENUM('MONTHLY', 'YEARLY', 'FOUNDING', 'MANUAL') NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `memberships_order_id_key`(`order_id`),
    INDEX `memberships_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_orders` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `merchant_order_number` VARCHAR(64) NOT NULL,
    `wechat_transaction_id` VARCHAR(64) NULL,
    `plan` ENUM('MONTHLY', 'YEARLY', 'FOUNDING', 'MANUAL') NOT NULL,
    `amount_cents` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_orders_merchant_order_number_key`(`merchant_order_number`),
    UNIQUE INDEX `membership_orders_wechat_transaction_id_key`(`wechat_transaction_id`),
    INDEX `membership_orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `membership_orders_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `albums` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `artist` VARCHAR(160) NOT NULL,
    `release_year` INTEGER NULL,
    `genre` VARCHAR(80) NULL,
    `cover_url` TEXT NULL,
    `rarity` ENUM('N', 'R', 'SR', 'SSR', 'UR') NOT NULL DEFAULT 'N',
    `source` ENUM('CATALOG', 'USER_CREATED') NOT NULL DEFAULT 'CATALOG',
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `albums_artist_release_year_idx`(`artist`, `release_year`),
    INDEX `albums_title_idx`(`title`),
    INDEX `albums_genre_idx`(`genre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `album_tracks` (
    `id` VARCHAR(191) NOT NULL,
    `album_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,

    UNIQUE INDEX `album_tracks_album_id_position_key`(`album_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collections` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `album_id` VARCHAR(191) NOT NULL,
    `purchase_price_cents` INTEGER NULL,
    `collected_at` DATETIME(3) NOT NULL,
    `source` VARCHAR(80) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `condition` VARCHAR(32) NULL,
    `medium_key` VARCHAR(32) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collections_user_id_album_id_key`(`user_id`, `album_id`),
    INDEX `collections_user_id_collected_at_idx`(`user_id`, `collected_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tv_devices` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `device_key_hash` VARCHAR(128) NOT NULL,
    `status` ENUM('BOUND', 'UNBOUND', 'DISABLED') NOT NULL DEFAULT 'BOUND',
    `last_synced_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tv_devices_device_key_hash_key`(`device_key_hash`),
    INDEX `tv_devices_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_events` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tv_device_id` VARCHAR(191) NULL,
    `type` ENUM('BOUND', 'UNBOUND', 'SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED') NOT NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_events_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `sync_events_tv_device_id_created_at_idx`(`tv_device_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `actor_type` ENUM('USER', 'SYSTEM', 'OPERATOR') NOT NULL,
    `actor_id` VARCHAR(128) NULL,
    `action` VARCHAR(100) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddCheckConstraints
ALTER TABLE `memberships`
ADD CONSTRAINT `memberships_valid_period_check`
CHECK (`expires_at` > `starts_at`);

ALTER TABLE `membership_orders`
ADD CONSTRAINT `membership_orders_amount_check`
CHECK (`amount_cents` >= 0);

ALTER TABLE `membership_orders`
ADD CONSTRAINT `membership_orders_commercial_plan_check`
CHECK (`plan` IN ('MONTHLY', 'YEARLY'));

ALTER TABLE `membership_orders`
ADD CONSTRAINT `membership_orders_paid_fields_check`
CHECK (
    `status` <> 'PAID'
    OR (`paid_at` IS NOT NULL AND `wechat_transaction_id` IS NOT NULL)
);

ALTER TABLE `albums`
ADD CONSTRAINT `albums_release_year_check`
CHECK (`release_year` IS NULL OR `release_year` BETWEEN 1800 AND 3000);

ALTER TABLE `album_tracks`
ADD CONSTRAINT `album_tracks_position_check`
CHECK (`position` > 0);

ALTER TABLE `collections`
ADD CONSTRAINT `collections_purchase_price_check`
CHECK (`purchase_price_cents` IS NULL OR `purchase_price_cents` >= 0);

ALTER TABLE `collections`
ADD CONSTRAINT `collections_quantity_check`
CHECK (`quantity` > 0);

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `memberships` ADD CONSTRAINT `memberships_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `membership_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `membership_orders` ADD CONSTRAINT `membership_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `albums` ADD CONSTRAINT `albums_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `album_tracks` ADD CONSTRAINT `album_tracks_album_id_fkey` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collections` ADD CONSTRAINT `collections_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collections` ADD CONSTRAINT `collections_album_id_fkey` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tv_devices` ADD CONSTRAINT `tv_devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sync_events` ADD CONSTRAINT `sync_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sync_events` ADD CONSTRAINT `sync_events_tv_device_id_fkey` FOREIGN KEY (`tv_device_id`) REFERENCES `tv_devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
