export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    /* Deliberately unguarded: a half-migrated schema makes every DB
       route 500, so failing the boot is louder and easier to fix than
       an app that starts and misbehaves. */
    console.log('Running database migrations...');
    await import('./lib/db/migrate');
    console.log('Database migrations completed successfully');

    await import('./lib/config/index');
  }
};
