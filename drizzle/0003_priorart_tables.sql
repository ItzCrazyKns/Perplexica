CREATE TABLE IF NOT EXISTS `priorart_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`featureId` text NOT NULL,
	`title` text NOT NULL,
	`priorityDate` text NOT NULL,
	`claimText` text,
	`status` text DEFAULT 'running',
	`createdAt` text NOT NULL,
	`markdownPath` text,
	`jsonPath` text,
	`claimChartPath` text,
	`warnings` text DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `priorart_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspaceId` text NOT NULL,
	`publicationNumber` text NOT NULL,
	`title` text,
	`source` text NOT NULL,
	`fusedScore` text,
	`json` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `priorart_documents_workspace_idx` ON `priorart_documents` (`workspaceId`);
