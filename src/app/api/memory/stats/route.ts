import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { memoryStats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/memory/stats - Get memory statistics for a user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const stats = await db.select().from(memoryStats)
      .where(eq(memoryStats.userId, userId))
      .limit(1);

    if (stats.length === 0) {
      // Return default stats if none exist
      return NextResponse.json({
        userId,
        totalMemories: 0,
        userMemories: 0,
        sessionMemories: 0,
        chatMemories: 0,
        lastCleanup: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(stats[0]);
  } catch (error) {
    console.error('Failed to get memory stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}