module.exports = {
  apps: [
    {
      name: 'perplexica',
      script: 'npm',
      args: 'start',
      cwd: '/opt/Perplexica',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: '/var/log/perplexica/combined.log',
      out_file: '/var/log/perplexica/out.log',
      error_file: '/var/log/perplexica/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
