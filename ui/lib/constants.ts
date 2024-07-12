export const ENV = {
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000",
  API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
} as const;

export type ENV = typeof ENV;

// Type guard function
export function assertEnvVariables(ENV: ENV): asserts ENV is Required<ENV> {
  const missingVariables = Object.entries(ENV).filter(([_, value]) => value === undefined);
  if (missingVariables.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingVariables.map(([key]) => key).join(", ")}`);
    console.warn("Using default values for missing variables.");
  }
}

assertEnvVariables(ENV);

export const VALIDATED_ENV: Required<ENV> = ENV as Required<ENV>;
