DROP INDEX "findings_test_id_idx";--> statement-breakpoint
DROP INDEX "tests_expires_at_idx";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `tests` ALTER COLUMN "consumer_duty_score" TO "consumer_duty_score" integer;--> statement-breakpoint
CREATE INDEX `findings_test_id_idx` ON `findings` (`test_id`);--> statement-breakpoint
CREATE INDEX `tests_expires_at_idx` ON `tests` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `tests` ADD `checker` text;--> statement-breakpoint
ALTER TABLE `asset_versions` ADD `asset_type` text;