export const ENV = {
  WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  API_URL: process.env.NEXT_PUBLIC_API_URL,
} as const;

export type ENV = typeof ENV;

// Type guard function
export function assertEnvVariables(ENV: ENV): asserts ENV is Required<ENV> {
  const missingVariables = Object.entries(ENV).filter(([_, value]) => value === undefined);
  if (missingVariables.length > 0) {
    throw new Error(`Missing environment variables: ${missingVariables.map(([key]) => key).join(", ")}`);
  }
}

assertEnvVariables(ENV);

export const VALIDATED_ENV: Required<ENV> = ENV as Required<ENV>;
