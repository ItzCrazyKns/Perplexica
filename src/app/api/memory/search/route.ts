import { NextRequest, NextResponse } from 'next/server';
import memoryService from '@/lib/memory';

export const runtime = 'nodejs';

// POST /api/memory/search - Search memories
export async function POST(req: NextRequest) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      query,
      userId,
      memoryType,
      chatId,
      sessionId,
      limit = 20,
    } = body;

    if (!query || !userId) {
      return NextResponse.json(
        { error: 'query and userId are required' },
        { status: 400 }
      );
    }

    if (memoryType && !['user', 'session', 'chat'].includes(memoryType)) {
      return NextResponse.json(
        { error: 'Invalid memoryType. Must be user, session, or chat' },
        { status: 400 }
      );
    }

    const result = await memoryService.searchMemories(query, {
      userId,
      memoryType,
      chatId,
      sessionId,
      limit,
    });

    return NextResponse.json({
      query,
      memories: result.memories,
      totalCount: result.totalCount,
    });
  } catch (error) {
    console.error('Failed to search memories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}