ALTER TABLE `notion_connections` ADD `singleton` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `notion_connections_singleton` ON `notion_connections` (`singleton`);
