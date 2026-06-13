import db from '@/lib/db';
import { spaces, chats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const space = await db.query.spaces.findFirst({
      where: eq(spaces.id, id),
    });

    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const spaceChats = await db.query.chats.findMany({
      where: eq(chats.spaceId, id),
    });

    return Response.json({ space, chats: spaceChats }, { status: 200 });
  } catch (err) {
    console.error('Error getting space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const body = await req.json();

    const space = await db.query.spaces.findFirst({
      where: eq(spaces.id, id),
    });

    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const { name, description, instructions, icon, useGlobalInstructions, defaultSourceScope } = body;

    if (name !== undefined && name !== space.name) {
      const existing = await db.query.spaces.findFirst({
        where: eq(spaces.name, name.trim()),
      });
      if (existing && existing.id !== id) {
        return Response.json(
          { message: 'A Space with that name already exists.' },
          { status: 409 },
        );
      }
    }

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (instructions !== undefined) updates.instructions = instructions;
    if (icon !== undefined) updates.icon = icon;
    if (useGlobalInstructions !== undefined) updates.useGlobalInstructions = useGlobalInstructions;
    if (defaultSourceScope !== undefined) updates.defaultSourceScope = defaultSourceScope;

    const [updated] = await db
      .update(spaces)
      .set(updates)
      .where(eq(spaces.id, id))
      .returning();

    return Response.json({ space: updated }, { status: 200 });
  } catch (err) {
    console.error('Error updating space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const space = await db.query.spaces.findFirst({
      where: eq(spaces.id, id),
    });

    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    await db.update(chats).set({ spaceId: null }).where(eq(chats.spaceId, id));

    await db.delete(spaces).where(eq(spaces.id, id));

    return Response.json({ message: 'Space deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Error deleting space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
