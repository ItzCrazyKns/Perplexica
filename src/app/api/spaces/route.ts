import db from '@/lib/db';
import { spaces, chats } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

export const GET = async () => {
  try {
    const allSpaces = await db.query.spaces.findMany({
      orderBy: (spaces, { desc }) => [desc(spaces.createdAt)],
    });

    const spacesWithCounts = await Promise.all(
      allSpaces.map(async (space) => {
        const count = await db
          .select({ count: sql<number>`count(*)` })
          .from(chats)
          .where(eq(chats.spaceId, space.id))
          .then((r) => r[0]?.count ?? 0);
        return { ...space, chatCount: count };
      }),
    );

    return Response.json({ spaces: spacesWithCounts }, { status: 200 });
  } catch (err) {
    console.error('Error listing spaces:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { name, description, instructions, icon } = body;

    if (!name?.trim()) {
      return Response.json({ message: 'Name is required.' }, { status: 400 });
    }

    const existing = await db.query.spaces.findFirst({
      where: eq(spaces.name, name.trim()),
    });

    if (existing) {
      return Response.json(
        { message: 'A Space with that name already exists.' },
        { status: 409 },
      );
    }

    const id = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const [space] = await db
      .insert(spaces)
      .values({
        id,
        name: name.trim(),
        description: description ?? null,
        instructions: instructions ?? null,
        icon: icon ?? { type: 'color', value: '#6366f1' },
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return Response.json({ space }, { status: 201 });
  } catch (err) {
    console.error('Error creating space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
