/* ============================================================
   لقاء — أدوات مشتركة بين الصفحات + تفعيل PWA
   - تسجيل Service Worker
   - زر تثبيت التطبيق (Install)
   - الوضع الليلي / تكبير الخط / التنبيهات (toast)
   ============================================================ */

/* ---------- Toast ---------- */
let toastT;
function toast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Theme ---------- */
function applyTheme(dark){
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const btn = document.getElementById('themeBtn');
  if(btn) btn.textContent = dark ? '☀️ نهاري' : '🌙 ليلي';
  localStorage.setItem('liqaa_theme', dark ? 'dark' : 'light');
}
function toggleTheme(){
  applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
}

/* ---------- Font size ---------- */
function changeFont(d){
  const r = getComputedStyle(document.documentElement).getPropertyValue('--fs');
  let cur = parseFloat(r) || 16;
  cur = Math.min(22, Math.max(13, cur + d));
  document.documentElement.style.setProperty('--fs', cur + 'px');
  localStorage.setItem('liqaa_fs', cur);
}
function resetFont(){
  document.documentElement.style.setProperty('--fs', '16px');
  localStorage.setItem('liqaa_fs', 16);
}

/* تطبيق الوضع والخط المحفوظين قبل رسم المحتوى */
(function applySavedUI(){
  try{
    if(localStorage.getItem('liqaa_theme') === 'dark') applyTheme(true);
    const fs = parseFloat(localStorage.getItem('liqaa_fs'));
    if(fs) document.documentElement.style.setProperty('--fs', fs + 'px');
  }catch(e){}
})();

/* ---------- Service Worker ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ---------- زر تثبيت التطبيق ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = true;
  toast('📲 تم تثبيت تطبيق «لقاء»');
});
function installApp(){
  const btn = document.getElementById('installBtn');
  if(deferredPrompt){
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; if(btn) btn.hidden = true; });
  }else if(btn){
    toast('📲 من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية»');
  }
}
