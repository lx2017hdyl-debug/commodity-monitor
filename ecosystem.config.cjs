/** PM2 进程配置：内网长期运行 */
module.exports = {
  apps: [
    {
      name: "commodity-monitor",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        /** 阿里云 / 内网：服务端拉行情 */
        NEXT_PUBLIC_DATA_MODE: "server",
      },
    },
  ],
};
