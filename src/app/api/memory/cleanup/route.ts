import { NextRequest, NextResponse } from 'next/server';
import memoryService from '@/lib/memory';

export const runtime = 'nodejs';

// POST /api/memory/cleanup - Clean up expired memories
export async function POST(req: NextRequest) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const cleanedCount = await memoryService.cleanupExpiredMemories();

    return NextResponse.json({
      message: `Cleaned up ${cleanedCount} expired memories`,
      cleanedCount,
    });
  } catch (error) {
    console.error('Failed to cleanup memories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}