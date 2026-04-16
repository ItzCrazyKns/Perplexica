import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/middleware';
import configManager from '@/lib/config';

export const runtime = 'nodejs';

// Get sensitive settings (SearXNG, AI model config) - admin only
export const GET = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const config = configManager.getCurrentConfig();

    // Only return server-scoped settings (model providers + search)
    const serverSettings = {
      search: config.search,
      modelProviders: config.modelProviders,
    };

    return NextResponse.json({ settings: serverSettings });
  } catch (err) {
    console.error('Admin get settings error:', err);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};

// Update sensitive settings - admin only
const updateSettingsSchema = z.object({
  search: z.record(z.string(), z.string()).optional(),
});

export const PUT = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const body = await req.json();
    const parse = updateSettingsSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parse.error.issues },
        { status: 400 },
      );
    }

    const data = parse.data;
    if (data.search) {
      const entries = Object.entries(data.search);
      for (let i = 0; i < entries.length; i++) {
        const k: string = entries[i][0];
        const v: string = entries[i][1];
        // Validate key to prevent prototype pollution
        if (!/^[a-zA-Z0-9_-]+$/.test(k)) {
          return NextResponse.json(
            { message: 'Invalid setting key' },
            { status: 400 },
          );
        }
        (configManager as any).updateConfig(`search.${k}`, v);
      }
    }

    return NextResponse.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Admin update settings error:', err);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};
