CREATE TABLE `compliance_outcomes` (
	`test_id` text PRIMARY KEY NOT NULL,
	`outcome` text NOT NULL,
	`note` text,
	`consent_to_improve` integer DEFAULT false NOT NULL,
	`review_status` text DEFAULT 'new' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tests` ADD `comprehension` text;