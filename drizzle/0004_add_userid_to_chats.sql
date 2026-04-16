-- Migration: Add userId column to chats table for multi-user support
ALTER TABLE `chats` ADD COLUMN `userId` text NOT NULL DEFAULT 'anonymous';
