/* ============================================================
   لقاء — إعدادات الاتصال بـ Supabase
   ============================================================
   كيف تحصل على القيمتين؟ (دقيقتان)
   1) أنشئ مشروعاً جديداً على https://supabase.com
   2) من لوحة المشروع: Settings → API
   3) انسخ:
      - Project URL  وضعها بين علامتي التنصيص في SUPABASE_URL
      - anon public  وضعها بين علامتي التنصيص في SUPABASE_ANON_KEY
   4) نفّذ محتوى الملف supabase-schema.sql في SQL Editor داخل Supabase
      (هو أنشئ الجداول وسياسات الحماية RLS دفعة واحدة)

   ⚠️ anon key آمن للاستخدام في المتصفح لأن حماية البيانات
      تعتمد على سياسات RLS في قاعدة البيانات نفسها.
   ============================================================ */

const SUPABASE_URL = 'https://hshegqzuucjqtgayrpft.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lxk0fPdhpTI-qIzqksl6lQ_e2kSZno3';

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
