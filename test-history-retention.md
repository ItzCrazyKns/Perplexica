# History Retention Feature Test Guide

This document outlines how to test the history retention feature that has been implemented.

## Features Implemented

1. **Config.toml Setting**: Added `RETENTION_DAYS` setting under `[HISTORY]` section
2. **Settings Page**: Added UI control to set history retention days when incognito mode is off
3. **API Endpoints**: 
   - Updated `/api/config` to handle history retention settings
   - Created `/api/cleanup-history` for manual cleanup
4. **Automatic Cleanup**: History cleanup runs automatically when new chats are created (non-incognito mode)

## Configuration

### config.toml
```toml
[HISTORY]
RETENTION_DAYS = 30 # Number of days to keep chat history when incognito mode is off (0 = keep forever)
```

### Settings Page
- Navigate to Settings page
- Find "History Settings" section
- Set "History Retention (Days)" value
- 0 = keep forever
- Any positive number = days to retain history

## How It Works

1. **When Incognito Mode is OFF**:
   - Chat history is saved to database
   - History cleanup runs automatically when creating new chats
   - Old chats (older than retention period) are automatically deleted

2. **When Incognito Mode is ON**:
   - Chat history is NOT saved to database
   - No cleanup needed as nothing is stored

3. **Cleanup Logic**:
   - Runs automatically in background when new chats are created
   - Deletes chats older than the configured retention period
   - Also deletes all messages associated with old chats
   - If retention is set to 0, keeps all history forever

## Testing Steps

1. **Set Retention Period**:
   - Go to Settings page
   - Set "History Retention (Days)" to a small number (e.g., 1 day for testing)
   - Save the setting

2. **Create Test Chats**:
   - Make sure incognito mode is OFF
   - Create several test chats
   - Verify they appear in chat history

3. **Test Manual Cleanup**:
   - Call POST `/api/cleanup-history` endpoint
   - Check response for cleanup results

4. **Test Automatic Cleanup**:
   - Wait for retention period to pass (or modify database dates for testing)
   - Create a new chat (triggers automatic cleanup)
   - Verify old chats are removed

5. **Test Incognito Mode**:
   - Turn ON incognito mode
   - Create chats - they should not be saved to history
   - Turn OFF incognito mode
   - Create chats - they should be saved and cleanup should work

## API Endpoints

### GET /api/config
Returns current configuration including `historyRetentionDays`

### POST /api/config
Updates configuration including `historyRetentionDays`

### POST /api/cleanup-history
Manually triggers history cleanup and returns results:
```json
{
  "message": "Cleaned up X old chats and their messages",
  "deletedChats": X
}
```

## Files Modified

1. `config.toml` - Added HISTORY section
2. `src/lib/config.ts` - Added history retention getter/setter
3. `src/app/api/config/route.ts` - Added history retention to API
4. `src/app/settings/page.tsx` - Added UI control for history retention
5. `src/app/api/cleanup-history/route.ts` - New cleanup endpoint
6. `src/lib/utils/historyCleanup.ts` - Cleanup utility functions
7. `src/app/api/chat/route.ts` - Integrated automatic cleanup

## Notes

- History retention only applies when incognito mode is OFF
- Cleanup runs automatically in background to avoid blocking chat creation
- Setting retention to 0 disables cleanup (keeps all history)
- Cleanup is based on chat creation date (`createdAt` field)
