CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  instructions TEXT,
  icon TEXT DEFAULT '{"type":"color","value":"#6366f1"}',
  useGlobalInstructions INTEGER NOT NULL DEFAULT 1,
  defaultSourceScope TEXT NOT NULL DEFAULT 'both',
  files TEXT NOT NULL DEFAULT '[]',
  webSources TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
--> statement-breakpoint
ALTER TABLE chats ADD COLUMN spaceId TEXT;
