CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`test_id` text NOT NULL,
	`trigger` text NOT NULL,
	`channel` text NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `asset_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`input_type` text NOT NULL,
	`source_url` text,
	`extracted_text` text NOT NULL,
	`layout` text,
	`screenshot_key` text,
	`file_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`score` text NOT NULL,
	`band` text NOT NULL,
	`severity` text NOT NULL,
	`probability` real NOT NULL,
	`decided_by` text NOT NULL,
	`evidence` text,
	`explanation` text NOT NULL,
	`suggestion` text,
	`reviewer_note` text,
	`flagged_wrong` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `findings_test_id_idx` ON `findings` (`test_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rule_sets` (
	`version` text PRIMARY KEY NOT NULL,
	`released_at` text NOT NULL,
	`changelog` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text NOT NULL,
	`rule_set_version` text NOT NULL,
	`score` text NOT NULL,
	`record` text NOT NULL,
	PRIMARY KEY(`id`, `rule_set_version`),
	FOREIGN KEY (`rule_set_version`) REFERENCES `rule_sets`(`version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_id` text NOT NULL,
	`fingerprints` text NOT NULL,
	`asset_version_id` text,
	`fetch_status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`watch_id`) REFERENCES `watches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_version_id` text NOT NULL,
	`rule_set_version` text NOT NULL,
	`model_version` text NOT NULL,
	`product` text,
	`audience` text,
	`channel` text,
	`is_promotion` integer NOT NULL,
	`finprom_score` integer,
	`consumer_duty_score` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tests_expires_at_idx` ON `tests` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`sign_in_method` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `watches` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`url` text NOT NULL,
	`schedule` text NOT NULL,
	`alert_settings` text,
	`last_checked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`settings` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
