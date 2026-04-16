import { NextResponse } from 'next/server';
import configManager from '@/lib/config';

export const runtime = 'nodejs';

export const GET = async () => {
  try {
    const sections = configManager.getUIConfigSections();
    return NextResponse.json({ sections });
  } catch (err) {
    console.error('Error fetching config sections:', err);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};
