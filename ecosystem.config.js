// pm2 config: `pm2 start ecosystem.config.js && pm2 save`
module.exports = {
  apps: [
    {
      name: 'document-request-system',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
