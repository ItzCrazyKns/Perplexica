import { NextRequest, NextResponse } from 'next/server';
import memoryService from '@/lib/memory';

export const runtime = 'nodejs';

interface Context {
  params: {
    id: string;
  };
}

// GET /api/memory/[id] - Get a specific memory
export async function GET(req: NextRequest, context: Context) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const { id } = context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    // Since we don't have a direct get method, we'll search for it
    // This is a limitation that could be improved in the service
    const result = await memoryService.searchMemories('', {
      userId: 'temp', // We need to find a way to get memories by ID
      limit: 1000,
    });

    const memory = result.memories.find(m => m.id === id);

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(memory);
  } catch (error) {
    console.error('Failed to get memory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/memory/[id] - Update a specific memory
export async function PUT(req: NextRequest, context: Context) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const { id } = context.params;
    const body = await req.json();
    const { memory, metadata, expiresAt } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    const result = await memoryService.updateMemory(id, {
      memory,
      metadata,
      expiresAt,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Memory not found or failed to update' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update memory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/memory/[id] - Delete a specific memory
export async function DELETE(req: NextRequest, context: Context) {
  try {
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        { error: 'Memory service is not enabled' },
        { status: 503 }
      );
    }

    const { id } = context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    const success = await memoryService.deleteMemory(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Memory not found or failed to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Failed to delete memory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}