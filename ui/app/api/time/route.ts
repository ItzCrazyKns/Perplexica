import { NextResponse } from 'next/server';

async function requestHandler(_request: Request): NextResponse {
  return NextResponse.json({ 'time': Date.now() });
}

export { requestHandler as GET };
