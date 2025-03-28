import db from '@/lib/db';
import { getSession } from '@auth0/nextjs-auth0';
import { chats } from '@/lib/db/schema'; // adjust this import to wherever your schema is defined
import { eq } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    const session = await getSession();
    if (!session?.user) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let userChats = await db.query.chats.findMany({
      where: eq(chats.userId, session.user.sub),
    });
    userChats = userChats.reverse();

    return Response.json({ chats: userChats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
