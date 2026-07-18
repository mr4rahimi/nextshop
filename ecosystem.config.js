/**
 * پیکربندی PM2
 *
 * راه‌اندازی کامل:      pm2 start ecosystem.config.js
 * فقط Worker:           pm2 start ecosystem.config.js --only mymonta-worker
 * مشاهده لاگ:           pm2 logs mymonta-worker
 * ری‌استارت بدون قطعی:  pm2 reload ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: "mymonta-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", PORT: 3000 },
      max_memory_restart: "1G",
      error_file: "./logs/web-error.log",
      out_file: "./logs/web-out.log",
      time: true,
    },
    {
      name: "mymonta-worker",
      script: "node_modules/.bin/tsx",
      args: "workers/index.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      time: true,
      // اگر بلافاصله کرش کرد، بی‌نهایت ری‌استارت نکن
      max_restarts: 10,
      min_uptime: "10s",
    },
    // فاز ۳: زمان‌بند کرون‌ها
    // {
    //   name: "mymonta-scheduler",
    //   script: "node_modules/.bin/tsx",
    //   args: "workers/scheduler.ts",
    //   cwd: __dirname,
    //   instances: 1,
    //   exec_mode: "fork",
    //   env: { NODE_ENV: "production" },
    // },
  ],
};
