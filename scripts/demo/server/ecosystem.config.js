/**
 * pm2 دموی عمومی — docs/plans/demo.md بخش «استقرار»
 *
 *   cd /var/www/gardanos-demo && pm2 start scripts/demo/server/ecosystem.config.js && pm2 save
 *
 * worker باشگاه (`workers/`) عمداً اینجا نیست: در دمو پیامک باشگاه فرستاده نمی‌شود.
 * worker یکپارچه‌سازی (سفارش‌های نمایشی بازارگاه) داخل همین پروسه‌ی وب است (instrumentation).
 */
module.exports = {
  apps: [
    {
      name: "gardanos-demo",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3050",
      // ریشه‌ی برنامه — سه پوشه بالاتر از scripts/demo/server
      cwd: `${__dirname}/../../..`,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", PORT: 3050 },
      // دمو کنار فروشگاه مای‌مونتا و پنل روی یک سرور است — نباید رم آن‌ها را بگیرد
      max_memory_restart: "900M",
      time: true,
    },
  ],
};
