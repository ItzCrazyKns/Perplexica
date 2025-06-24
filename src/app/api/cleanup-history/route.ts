import { cleanupOldHistory } from '@/lib/utils/historyCleanup';

export const POST = async (req: Request) => {
  try {
    const result = await cleanupOldHistory();
    
    return Response.json({ 
      message: result.message,
      deletedChats: result.deletedChats
    }, { status: 200 });

  } catch (err) {
    console.error('An error occurred while cleaning up history:', err);
    return Response.json(
      { message: 'An error occurred while cleaning up history' },
      { status: 500 },
    );
  }
};
