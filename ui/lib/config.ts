interface Config {
  GENERAL: {
    NEXT_PUBLIC_SUPER_SECRET_KEY: string;
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_WS_URL: string;
  };
}

const loadEnv = () => {
  return {
    GENERAL: {
      NEXT_PUBLIC_SUPER_SECRET_KEY: process.env.NEXT_PUBLIC_SUPER_SECRET_KEY!,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL!,
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL!,
    },
  } as Config;
};

export const getAccessKey = () =>
  loadEnv().GENERAL.NEXT_PUBLIC_SUPER_SECRET_KEY;

export const getBackendURL = () => loadEnv().GENERAL.NEXT_PUBLIC_API_URL;
