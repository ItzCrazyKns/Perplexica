import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { desc, asc } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const GET = async (req: NextRequest) => {
  try {
    const sort = req.nextUrl.searchParams.get('sort') || 'newest';
    const order = sort === 'oldest' ? asc : desc;
    const result = await db.select().from(chats).orderBy(order(chats.createdAt));
    return Response.json({ chats: result }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
