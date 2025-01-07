import './config/env'; // Load environment variables first
import { startServer } from './server';
import { isPortAvailable } from './utils/portCheck';
import { testConnection } from './lib/supabase';

const PORT = process.env.PORT || 3001;

const init = async () => {
  if (!await isPortAvailable(PORT)) {
    console.error(`Port ${PORT} is in use. Please try a different port or free up the current one.`);
    process.exit(1);
  }

  // Test Supabase connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Failed to connect to Supabase. Please check your configuration.');
    process.exit(1);
  }

  startServer();
};

init().catch(console.error); 