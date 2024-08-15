import { NextRequest, NextResponse } from 'next/server';
import process from 'process';

export async function requestHandler(_request: NextRequest): NextResponse {
  // Access environment variables
  const envVars = {
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL
  }

  // Return the environment variables as a JSON response
  return NextResponse.json(envVars);
}

export { requestHandler as GET };