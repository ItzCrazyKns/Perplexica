import { NextRequest, NextResponse } from 'next/server';
import process from 'process';

export async function GET(request: NextRequest) {
  // Access environment variables
  const envVars = {
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL
  }

  // Return the environment variables as a JSON response
  return NextResponse.json(envVars);
}