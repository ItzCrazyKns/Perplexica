import db from '@/lib/db';
import { auth0 } from '@/lib/auth0';
import { chats } from '@/lib/db/schema'; // adjust this import to wherever your schema is defined
import { eq } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    // Log that we're starting the request
    console.log('Starting /api/chats GET request');

    const session = await auth0.getSession();
    console.log('Session status:', session ? 'exists' : 'null');

    if (!session?.user) {
      console.log('No session found, returning 401');
      return Response.json(
        { message: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    console.log('User ID:', session.user.sub);

    // Log the database query attempt
    console.log('Attempting database query');
    let userChats = await db.query.chats.findMany({
      where: eq(chats.userId, session.user.sub),
    });
    console.log('Query successful, found', userChats.length, 'chats');

    userChats = userChats.reverse();

    return Response.json({ chats: userChats }, { status: 200 });
  } catch (err) {
    // Log the full error details
    console.error('Detailed error in getting chats:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined
    });

    return Response.json(
      { 
        message: 'An error has occurred while fetching chats.',
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
