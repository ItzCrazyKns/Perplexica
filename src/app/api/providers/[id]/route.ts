import ModelRegistry from '@/lib/models/registry';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware';

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    // Require admin auth
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const { id } = await params;

    if (!id) {
      return Response.json(
        { message: 'Provider ID is required.' },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();
    await registry.removeProvider(id);

    return Response.json(
      { message: 'Provider deleted successfully.' },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('An error occurred while deleting provider', err.message);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    // Require admin auth
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const body = await req.json();
    const { name, config } = body;
    const { id } = await params;

    if (!id || !name || !config) {
      return Response.json(
        { message: 'Missing required fields.' },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();

    const updatedProvider = await registry.updateProvider(id, name, config);

    return Response.json(
      { provider: updatedProvider },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('An error occurred while updating provider', err.message);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
