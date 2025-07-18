import db from '@/lib/db';
import { systemPrompts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { name, content, type } = await req.json();
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 },
      );
    }
    if (type && type !== 'system' && type !== 'persona') {
      return NextResponse.json(
        { error: 'Type must be either "system" or "persona"' },
        { status: 400 },
      );
    }

    const updateData: any = { name, content, updatedAt: new Date() };
    if (type) {
      updateData.type = type;
    }

    const updatedPrompt = await db
      .update(systemPrompts)
      .set(updateData)
      .where(eq(systemPrompts.id, id))
      .returning();
    if (updatedPrompt.length === 0) {
      return NextResponse.json(
        { error: 'System prompt not found' },
        { status: 404 },
      );
    }
    return NextResponse.json(updatedPrompt[0]);
  } catch (error) {
    console.error('Failed to update system prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update system prompt' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deletedPrompt = await db
      .delete(systemPrompts)
      .where(eq(systemPrompts.id, id))
      .returning();
    if (deletedPrompt.length === 0) {
      return NextResponse.json(
        { error: 'System prompt not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: 'System prompt deleted successfully' });
  } catch (error) {
    console.error('Failed to delete system prompt:', error);
    return NextResponse.json(
      { error: 'Failed to delete system prompt' },
      { status: 500 },
    );
  }
}
