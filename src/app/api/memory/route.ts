import { NextRequest, NextResponse } from 'next/server';
import memoryService from '@/lib/memory';
import { generateUserId } from '@/lib/memory/utils';

export const runtime = 'nodejs';

// GET /api/memory - Get all memories for a user
export async function GET(req: NextRequest) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const memoryType = searchParams.get('memoryType') as 'user' | 'session' | 'chat' | undefined;
    const chatId = searchParams.get('chatId');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const result = await memoryService.searchMemories('', {
      userId,
      memoryType,
      chatId: chatId || undefined,
      sessionId: sessionId || undefined,
      limit,
    });

    return NextResponse.json({
      memories: result.memories,
      totalCount: result.totalCount,
    });
  } catch (error) {
    console.error('Failed to get memories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/memory - Add a new memory
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
      userId,
      memory,
      memoryType = 'user',
      chatId,
      sessionId,
      metadata,
      expiresAt,
    } = body;

    if (!userId || !memory) {
      return NextResponse.json(
        { error: 'userId and memory are required' },
        { status: 400 }
      );
    }

    if (!['user', 'session', 'chat'].includes(memoryType)) {
      return NextResponse.json(
        { error: 'Invalid memoryType. Must be user, session, or chat' },
        { status: 400 }
      );
    }

    const result = await memoryService.addMemory(memory, {
      userId,
      memoryType,
      chatId,
      sessionId,
      metadata,
      expiresAt,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to add memory' },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to add memory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/memory - Delete all memories for user/session/chat
export async function DELETE(req: NextRequest) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const memoryType = searchParams.get('memoryType') as 'user' | 'session' | 'chat' | undefined;
    const chatId = searchParams.get('chatId');
    const sessionId = searchParams.get('sessionId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get all memories matching criteria
    const memories = await memoryService.searchMemories('', {
      userId,
      memoryType,
      chatId: chatId || undefined,
      sessionId: sessionId || undefined,
      limit: 1000, // Large limit to get all
    });

    // Delete each memory
    let deletedCount = 0;
    for (const memory of memories.memories) {
      const success = await memoryService.deleteMemory(memory.id);
      if (success) deletedCount++;
    }

    return NextResponse.json({
      message: `Deleted ${deletedCount} memories`,
      deletedCount,
    });
  } catch (error) {
    console.error('Failed to delete memories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}