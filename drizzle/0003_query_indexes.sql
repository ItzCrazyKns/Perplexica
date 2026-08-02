CREATE INDEX IF NOT EXISTS `idx_messages_chatId` ON `messages` (`chatId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chats_createdAt` ON `chats` (`createdAt`);
