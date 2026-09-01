# HR Kit

مرجع عام لنماذج وأدوات وملفات الموارد البشرية.

## البنية
- Cloudflare Workers: التطبيق والـAPI
- Workers Static Assets: الواجهة
- D1: بيانات الموارد والتصنيفات
- R2: الملفات

Cloudflare توصي باستخدام Workers Static Assets للتطبيقات الجديدة، ويمكن ربط Worker مباشرة بـD1 وR2 عبر bindings.

## التشغيل
1. ثبّت Node.js.
2. نفّذ `npm install`.
3. أنشئ D1:
   `npx wrangler d1 create hr_kit_db`
4. انسخ `database_id` إلى `wrangler.toml`.
5. أنشئ R2:
   `npx wrangler r2 bucket create hr-kit-files`
6. طبّق قاعدة البيانات:
   `npm run db:remote`
7. ضع كلمة مرور الإدارة:
   `npx wrangler secret put ADMIN_PASSWORD`
8. شغّل محليًا:
   `npm run dev`
9. انشر:
   `npm run deploy`

## ملاحظة
هذا هو الأساس V1. قبل الإطلاق العام يفضل إضافة حماية أقوى للوحة الإدارة، تحديد حجم وأنواع الملفات، rate limiting، وسجل تدقيق للتعديلات.
