import { NextResponse } from 'next/server';

async function requestHandler(_request: Request): NextResponse {
  return NextResponse.json({ 'response': 'Hello World' });
}

export { requestHandler as GET };