import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import db from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { chats, messages } from '@/lib/db/schema';

export const runtime = 'nodejs';

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const auth = await requireAuth(req);
    if (!auth.success) return auth.error;

    const { id } = await params;

    const [chat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, id), eq(chats.userId, auth.user.id)));

    if (!chat) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, id));

    return Response.json(
      { chat, messages: chatMessages },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const auth = await requireAuth(req);
    if (!auth.success) return auth.error;

    const { id } = await params;

    const [chat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, id), eq(chats.userId, auth.user.id)));

    if (!chat) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    await db.delete(chats).where(eq(chats.id, id)).execute();
    await db.delete(messages).where(eq(messages.chatId, id)).execute();

    return Response.json({ message: 'Chat deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
