import db from '@/lib/db';
import { chats, messages, spaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, id),
    });

    let space: { id: string; name: string; icon: any } | null = null;
    if (chatExists.spaceId) {
      const spaceRow = await db.query.spaces.findFirst({
        where: eq(spaces.id, chatExists.spaceId),
      });
      if (spaceRow) {
        space = { id: spaceRow.id, name: spaceRow.name, icon: spaceRow.icon };
      }
    }

    return Response.json(
      {
        chat: chatExists,
        messages: chatMessages,
        space,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const body = await req.json();

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    if ('spaceId' in body) updates.spaceId = body.spaceId ?? null;

    if (Object.keys(updates).length === 0) {
      return Response.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    await db.update(chats).set(updates).where(eq(chats.id, id)).execute();

    const updated = await db.query.chats.findFirst({ where: eq(chats.id, id) });

    return Response.json({ chat: updated }, { status: 200 });
  } catch (err) {
    console.error('Error updating chat:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    await db.delete(chats).where(eq(chats.id, id)).execute();
    await db.delete(messages).where(eq(messages.chatId, id)).execute();

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
