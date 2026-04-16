import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import db from '@/lib/db';
import { eq } from 'drizzle-orm';
import { chats } from '@/lib/db/schema';

export const runtime = 'nodejs';

export const GET = async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);
    if (!auth.success) return auth.error;

    // Debug: try a simple query without userId filter
    let allChats = await db.select().from(chats);
    console.log('All chats:', allChats.length);

    // Now try with userId filter
    let userChats = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, auth.user.id as string));

    userChats = userChats.reverse();

    return NextResponse.json({ chats: userChats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return NextResponse.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
