ALTER TABLE `priorart_workspaces` ADD COLUMN `lastStep` text;
--> statement-breakpoint
ALTER TABLE `priorart_workspaces` ADD COLUMN `progress` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `priorart_workspaces` ADD COLUMN `errorMessage` text;
--> statement-breakpoint
ALTER TABLE `priorart_workspaces` ADD COLUMN `lastUpdatedAt` text;
