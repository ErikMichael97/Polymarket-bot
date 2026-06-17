module.exports = {
  apps: [
    {
      name: 'sentinel-bot',
      script: './node_modules/.bin/tsx',
      args: 'bot-with-dashboard.ts',
      node_args: '--max-old-space-size=512',
      env_file: '.env',
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
  ],
};
