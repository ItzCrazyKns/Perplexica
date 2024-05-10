interface Config {
  GENERAL: {
    SUPER_SECRET_KEY: string;
    NEXT_PUBLIC_API_URL: string;
  };
}

const loadEnv = () => {
  return {
    GENERAL: {
      SUPER_SECRET_KEY: process.env.SUPER_SECRET_KEY!,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL!,
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL!
    },
  } as Config;
};

export const getAccessKey = () => loadEnv().GENERAL.SUPER_SECRET_KEY;

export const getBackendURL = () => loadEnv().GENERAL.NEXT_PUBLIC_API_URL;
