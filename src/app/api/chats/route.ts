import db from '@/lib/db';

export const GET = async (req: Request) => {
  try {
    let chats = await db.query.chats.findMany();
    chats = chats.reverse();
    return Response.json({ chats: chats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (req: Request) => {
  try {
    await db.delete(messages);
    await db.delete(chats);
    return Response.json(
      { message: 'Deleted all the chats and messages ' },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error deleting all chats: ', err);
    return Response.json(
      { message: 'An error has occurred. ' },
      { status: 500 },
    );
  }
};
