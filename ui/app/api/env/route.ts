import { Response } from 'next/server';
import process from 'process';

async function requestHandler(_request: Request): Response {
  // Access environment variables
  const envVars = {
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL
  }

  // Return the environment variables as a JSON response
  return Response.json(envVars);
}

export { requestHandler as GET };