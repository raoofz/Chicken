===================================================
 مدير المزرعة — نسخة احتياطية كاملة
 Poultry Farm Manager — Complete Backup
===================================================

التاريخ / Date: 2026-04-15 21:34:26

المحتوى / Contents:
1. poultry_app_code.tar.gz  — كامل كود التطبيق (مصدر)
2. database_backup.sql      — قاعدة البيانات كاملة (SQL dump)
3. README.txt               — هذا الملف

كيفية استعادة الكود / Restore Code:
  tar -xzf poultry_app_code.tar.gz
  pnpm install
  pnpm run dev

كيفية استعادة قاعدة البيانات / Restore Database:
  psql -U postgres -d your_db_name < database_backup.sql

التقنيات / Tech Stack:
  Frontend : React + Vite + TypeScript + Tailwind CSS
  Backend  : Node.js + Express + TypeScript
  Database : PostgreSQL + Drizzle ORM
  AI       : Rule-based NLP + Computer Vision Engine
  Languages: Arabic (AR) + Swedish (SV)

بيانات الدخول الافتراضية / Default Credentials:
  المدراء  / Admins : yones / raoof / nassar  (كلمة المرور / password: 1234)
  العمال  / Workers : hoobi / abood           (كلمة المرور / password: 1234)
===================================================
