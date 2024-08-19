import process from 'process';
import { NextResponse } from 'next/server';

async function requestHandler(_request: Request): NextResponse {
  // Access environment variables
  const envVars = {
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL
  }

  // Return the environment variables as a JSON response
  return NextResponse.json(envVars);
}

export { requestHandler as GET };