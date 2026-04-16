-- Migration: Add users and sessions tables for multi-user auth
CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `role` text DEFAULT 'user' NOT NULL,
  `createdAt` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL,
  `expiresAt` text NOT NULL,
  `createdAt` text NOT NULL
);
