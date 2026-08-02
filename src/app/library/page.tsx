import db from '@/lib/db';
import { desc } from 'drizzle-orm';
import { chats as chatsSchema } from '@/lib/db/schema';
import ChatList from '@/components/Library/ChatList';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  sources: string[];
  files: { fileId: string; name: string }[];
}

/* Same bound as /api/chats; nothing pages past it yet. */
const MAX_CHATS = 200;

const Page = async () => {
  const chats = (await db.query.chats.findMany({
    orderBy: [desc(chatsSchema.createdAt)],
    limit: MAX_CHATS,
  })) as Chat[];

  return <ChatList initialChats={chats} />;
};

export default Page;
