import process from 'process';
import { NextResponse } from 'next/server';

export async function GET(_request: Request) {
  // Access environment variables
  const envVars = {
    'BACKEND_API_URL': process.env.BACKEND_API_URL,
    'BACKEND_WS_URL': process.env.BACKEND_WS_URL
  }

  // Return the environment variables as a JSON response
  return NextResponse.json(envVars);
}
