# HR Kit

مرجع موظف الموارد البشرية للنماذج والخطابات والملفات.

## النسخة الحالية
- هوية بصرية مبنية على اللوقو الأصلي بدون تعديل عليه.
- تصميم متجاوب للجوال والكمبيوتر.
- الأقسام الرئيسية مرنة ويمكن إضافة/إخفاء/ترتيب الأقسام من لوحة الإدارة.
- إدارة الملفات: إضافة، تعديل، نشر، إخفاء، أرشفة وحذف.
- لا يحتاج المدير إلى إدخال "نوع الملف" أو "اسم الملف الأصلي"؛ النظام يحاول التعرف عليهما تلقائيًا من رابط الملف، ولا يعرضهما كحقول للمستخدم.
- اختيار أيقونات جاهزة للأقسام.
- روابط X وLinkedIn ونموذج الاقتراحات قابلة للتعديل من لوحة الإدارة وتظهر تلقائيًا في الهيدر والفوتر.
- نظام دخول للإدارة بجلسة مؤقتة بدل تخزين كلمة المرور في المتصفح.
- كلمة المرور الافتراضية عند أول تشغيل: `1234`. يوصى بتغييرها مباشرة من قسم "كلمة المرور".

## Cloudflare D1
المشروع لا يحتاج متغير `ADMIN_PASSWORD` في Runtime Variables and Secrets.

عند أول تشغيل يتم إنشاء جداول الإعدادات والجلسات تلقائيًا داخل D1، وتتم تهيئة كلمة المرور الافتراضية إلى `1234` بشكل مجزأ (SHA-256). بعد تسجيل الدخول يمكن تغييرها من لوحة الإدارة.

لتسجيل الـmigration رسميًا على قاعدة D1 البعيدة:

```bash
npm install
npm run db:remote
npm run deploy
```

إذا كانت قاعدة البيانات قديمة ولم تُطبق عليها الأعمدة الجديدة، فإن Worker يحتوي أيضًا على فحص توافق تلقائي يضيف الأعمدة المطلوبة عند التشغيل.

## ملاحظات
- رابط الملف هو الحقل الأساسي عند إضافة مورد.
- إذا كان اسم الملف داخل الرابط واضحًا بامتداد مثل `.pdf` أو `.docx` أو `.xlsx` فسيتم التعرف عليه تلقائيًا.
- إذا كان الرابط من خدمة لا يظهر اسم الملف في عنوان URL، يبقى اسم الملف الداخلي فارغًا، وهذا لا يمنع فتح/تحميل الملف.
- روابط الحسابات الاجتماعية ونموذج الاقتراحات يتم إدخالها مرة واحدة من: لوحة الإدارة → روابط الموقع.


## تخزين الملفات عبر GitHub Releases

يمكن للموقع رفع الملفات مباشرة إلى GitHub Releases بدل تخزينها في Cloudflare R2.

### إعداد Cloudflare

في Worker → Settings → Variables and Secrets أضف:

- `GITHUB_TOKEN` — **Secret**
- `GITHUB_OWNER` — Variable = `mohammed-10-f`
- `GITHUB_REPO` — Variable = `hr-reference-files`
- `GITHUB_RELEASE_TAG` — Variable = `files-v1`

يجب أن يكون `GITHUB_TOKEN` من نوع Fine-grained Personal Access Token، وممنوحًا للمستودع `hr-reference-files` مع صلاحية:

`Contents: Read and write`

بعد الحفظ، يستطيع المدير من لوحة HR Reference اختيار ملف من جهازه. Worker ينشئ Release `files-v1` عند الحاجة، ثم يرفع الملف كـRelease Asset ويحفظ رابط `browser_download_url` في قاعدة البيانات. زر التحميل في الموقع يمر عبر `/api/download/:id` ثم يحوّل المستخدم إلى رابط التنزيل المباشر.

### مهم

`GITHUB_TOKEN` لا يوضع في الكود ولا في `wrangler.toml` ولا في واجهة الموقع. يبقى Secret داخل Cloudflare فقط.


### اختبار اتصال GitHub

بعد تسجيل الدخول إلى لوحة الإدارة، افتح **إعدادات الموقع** واضغط **اختبار اتصال GitHub**.
كما يتوفر endpoint محمي للإدارة:
`GET /api/admin/github/test`

الاختبار لا يعرض الـ token، ويعيد حالة HTTP ورسالة GitHub التفصيلية عند الفشل.

### إعدادات Cloudflare المطلوبة

Runtime Variables:
- `GITHUB_OWNER=mohammed-10-f`
- `GITHUB_REPO=hr-reference-files`
- `GITHUB_RELEASE_TAG=files-v1`

Secret:
- `GITHUB_TOKEN=<secret>`

الـ token يجب أن يكون Fine-grained Personal Access Token، ومقيدًا بالمستودع `mohammed-10-f/hr-reference-files` مع:
- Contents: Read and write

### النشر

```bash
npm install
npx wrangler deploy
```

أو استخدم script المشروع:

```bash
npm run deploy
```

### رفع الملفات

رفع الملفات يتم من `FormData` إلى Worker، ثم:
1. جلب Release بالوسم `files-v1`.
2. إنشاءه عند عدم وجوده.
3. فحص Release Assets عن نفس اسم الملف.
4. حذف الـ asset القديم إن وجد.
5. رفع الملف binary إلى `uploads.github.com`.
6. حفظ `browser_download_url` في D1.
