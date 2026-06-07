# ☕ بوت ميمي

بوت واتساب بيمثل محمود ميمي في جروب القهوة بس!

---

## 🚀 طريقة التشغيل على Railway

### الخطوة 1 — رفع الكود على GitHub
1. روح على https://github.com وعمل حساب لو مش عندك
2. عمل Repository جديد اسمه `mimi-bot`
3. ارفع ملفات المشروع عليه

### الخطوة 2 — إنشاء مشروع على Railway
1. روح على https://railway.app
2. سجل بحساب GitHub
3. اضغط "New Project" ← "Deploy from GitHub repo"
4. اختار مشروع `mimi-bot`

### الخطوة 3 — إضافة المتغيرات
في Railway، روح على Variables وأضف:
```
GEMINI_API_KEY = مفتاحك من aistudio.google.com
COFFEE_GROUP_KEYWORD = القهوة
```

### الخطوة 4 — مسح الـ QR Code
1. افتح Deployments في Railway
2. اضغط على الـ Deploy الحالي
3. اضغط على "View Logs"
4. هتلاقي QR Code — امسحه من واتس بيزنس

### الخطوة 5 — خلاص! ✅
البوت شغال. لو الجروب اسمه فيه "القهوة" هيلاقيه لوحده.

---

## 🔑 جيب Gemini API Key مجاناً
1. روح على: https://aistudio.google.com/app/apikey
2. اضغط "Create API Key"
3. انسخه وحطه في Railway

---

## ⚠️ ملاحظات مهمة
- البوت بيرد في جروب القهوة بس
- بيرد لما بيكلموه مباشرة أو بنسبة 35% عشوائي
- لو الرقم اتحظر، غير الرقم وامسح مجلد `auth_info_baileys`
