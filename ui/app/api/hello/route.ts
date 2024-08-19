import { NextResponse } from 'next/server';

export async function GET(_request: Request) {
  return NextResponse.json({ 'response': 'Hello World' });
}
