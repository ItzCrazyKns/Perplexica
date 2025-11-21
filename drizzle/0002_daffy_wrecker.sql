PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`chatId` text NOT NULL,
	`backendId` text NOT NULL,
	`query` text NOT NULL,
	`createdAt` text NOT NULL,
	`responseBlocks` text DEFAULT '[]',
	`status` text DEFAULT 'answering'
);
--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;