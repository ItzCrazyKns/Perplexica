const { execSync } = require('child_process');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    execSync('npm run db:migrate', { stdio: 'inherit' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations(); 