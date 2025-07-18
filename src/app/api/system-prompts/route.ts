import db from '@/lib/db';
import { systemPrompts } from '@/lib/db/schema';
import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    let prompts;

    if (type && (type === 'system' || type === 'persona')) {
      prompts = await db
        .select()
        .from(systemPrompts)
        .where(eq(systemPrompts.type, type))
        .orderBy(asc(systemPrompts.name));
    } else {
      prompts = await db
        .select()
        .from(systemPrompts)
        .orderBy(asc(systemPrompts.name));
    }

    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Failed to fetch system prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system prompts' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { name, content, type = 'system' } = await req.json();
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
    const newPrompt = await db
      .insert(systemPrompts)
      .values({
        name,
        content,
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return NextResponse.json(newPrompt[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create system prompt:', error);
    return NextResponse.json(
      { error: 'Failed to create system prompt' },
      { status: 500 },
    );
  }
}
