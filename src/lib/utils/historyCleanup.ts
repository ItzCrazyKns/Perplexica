import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { getHistoryRetentionDays } from '@/lib/config';
import { lt, eq } from 'drizzle-orm';

export const cleanupOldHistory = async (): Promise<{ deletedChats: number; message: string }> => {
  try {
    const retentionDays = getHistoryRetentionDays();
    
    // If retention is 0, keep forever
    if (retentionDays === 0) {
      return { deletedChats: 0, message: 'History retention disabled, keeping all chats' };
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateString = cutoffDate.toISOString();

    // Find chats older than retention period
    const oldChats = await db
      .select({ id: chats.id })
      .from(chats)
      .where(lt(chats.createdAt, cutoffDateString));

    if (oldChats.length === 0) {
      return { deletedChats: 0, message: 'No old chats to clean up' };
    }

    const chatIds = oldChats.map((chat: { id: string }) => chat.id);

    // Delete messages for old chats
    for (const chatId of chatIds) {
      await db.delete(messages).where(eq(messages.chatId, chatId));
    }

    // Delete old chats
    await db.delete(chats).where(lt(chats.createdAt, cutoffDateString));

    return { 
      deletedChats: oldChats.length,
      message: `Cleaned up ${oldChats.length} old chats and their messages`
    };

  } catch (err) {
    console.error('An error occurred while cleaning up history:', err);
    throw new Error('Failed to cleanup history');
  }
};

// Function to check if cleanup should run (run cleanup every 24 hours)
export const shouldRunCleanup = (): boolean => {
  const lastCleanup = localStorage.getItem('lastHistoryCleanup');
  if (!lastCleanup) return true;
  
  const lastCleanupTime = new Date(lastCleanup);
  const now = new Date();
  const hoursSinceLastCleanup = (now.getTime() - lastCleanupTime.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceLastCleanup >= 24;
};

// Function to mark cleanup as completed
export const markCleanupCompleted = (): void => {
  localStorage.setItem('lastHistoryCleanup', new Date().toISOString());
};
