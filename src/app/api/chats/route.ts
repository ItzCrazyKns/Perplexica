import db from '@/lib/db';
import { desc } from 'drizzle-orm';
import { chats } from '@/lib/db/schema';

/* Bounded: this previously loaded every chat row on each library
   visit. Nothing pages past this yet, so the cap is the page size. */
const MAX_CHATS = 200;

export const GET = async (req: Request) => {
  try {
    const chatList = await db.query.chats.findMany({
      orderBy: [desc(chats.createdAt)],
      limit: MAX_CHATS,
    });
    return Response.json({ chats: chatList }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
