ALTER TABLE `users`
  ADD COLUMN `phone_number` VARCHAR(32) NULL,
  ADD COLUMN `phone_country_code` VARCHAR(8) NULL,
  ADD COLUMN `phone_authorized_at` DATETIME(3) NULL;
