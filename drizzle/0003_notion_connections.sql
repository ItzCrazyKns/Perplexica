--> statement-breakpoint
CREATE TABLE `notion_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`workspace_name` text NOT NULL,
	`encrypted_token` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
