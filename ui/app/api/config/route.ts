import { NextResponse } from 'next/server';
import process from 'process';

export async function GET() {
  return NextResponse.json({
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL
  });
}
