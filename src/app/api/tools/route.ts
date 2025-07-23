import { NextResponse } from 'next/server';
import { allTools } from '@/lib/tools';

export async function GET() {
  try {
    // Map over all tools to extract name and description
    const toolsList = allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));

    return NextResponse.json(toolsList);
  } catch (error) {
    console.error('Error fetching tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available tools' },
      { status: 500 },
    );
  }
}
