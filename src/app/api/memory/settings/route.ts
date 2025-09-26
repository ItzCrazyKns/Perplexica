import { NextRequest, NextResponse } from 'next/server';
import memoryService from '@/lib/memory';

export const runtime = 'nodejs';

// GET /api/memory/settings - Get user's memory settings
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

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const settings = await memoryService.getUserSettings(userId);

    if (!settings) {
      return NextResponse.json(
        { error: 'Failed to get user settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to get memory settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/memory/settings - Update user's memory settings
export async function PUT(req: NextRequest) {
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
      memoryEnabled,
      retentionDays,
      maxMemories,
      autoCleanup,
      privacyLevel,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Validate privacy level
    if (privacyLevel && !['high', 'medium', 'low'].includes(privacyLevel)) {
      return NextResponse.json(
        { error: 'Invalid privacyLevel. Must be high, medium, or low' },
        { status: 400 }
      );
    }

    // Validate numeric values
    if (retentionDays !== undefined && (retentionDays < 0 || retentionDays > 3650)) {
      return NextResponse.json(
        { error: 'retentionDays must be between 0 and 3650' },
        { status: 400 }
      );
    }

    if (maxMemories !== undefined && (maxMemories < 0 || maxMemories > 100000)) {
      return NextResponse.json(
        { error: 'maxMemories must be between 0 and 100000' },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (memoryEnabled !== undefined) updates.memoryEnabled = memoryEnabled;
    if (retentionDays !== undefined) updates.retentionDays = retentionDays;
    if (maxMemories !== undefined) updates.maxMemories = maxMemories;
    if (autoCleanup !== undefined) updates.autoCleanup = autoCleanup;
    if (privacyLevel !== undefined) updates.privacyLevel = privacyLevel;

    const settings = await memoryService.updateUserSettings(userId, updates);

    if (!settings) {
      return NextResponse.json(
        { error: 'Failed to update user settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to update memory settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}