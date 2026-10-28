/* ============================================================
   لقاء — طبقة Supabase: المصادقة + المزامنة + جلسات المستخدم
   يعتمد على مكتبة supabase-js (تُحمَّل في index.html قبل هذا الملف)
   ============================================================ */
window.LiqaaS = (function(){
  'use strict';
  const LOCAL_KEY = 'liqaa_data_v1';
  const CUR_KEY   = 'liqaa_current_id';
  let sb = null, user = null, enabled = false, currentId = null, timer = null, authTab = 'in';

  const $ = id => document.getElementById(id);
  const cfgOK = () =>
    typeof window.SUPABASE_URL === 'string' &&
    /^https?:\/\//.test(window.SUPABASE_URL) &&
    !window.SUPABASE_URL.includes('ضع-هنا') &&
    typeof window.SUPABASE_ANON_KEY === 'string' &&
    window.SUPABASE_ANON_KEY.length > 20 &&
    !window.SUPABASE_ANON_KEY.includes('ضع-هنا');
  const on = () => enabled && !!user;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- حالة السحابة ---------- */
  function setCloud(state){
    const el = $('cloudState');
    if(!el) return;
    if(!on()){ el.innerHTML = '💾 الوضع الحالي: حفظ محلي فقط — <b>سجّل الدخول</b> للمزامنة السحابية'; return; }
    el.textContent = {saving:'☁️ ⏳ يجري الرفع…', saved:'☁️ ✓ محفوظ في سحابتك', error:'☁️ ⚠️ تعذر الرفع — سيُعاد المحاولة'}[state] || '';
  }

  /* ---------- واجهة الشريط العلوي ---------- */
  function updateAuthUI(){
    const lb=$('loginBtn'), lo=$('logoutBtn'), li=$('libBtn'), chip=$('userChip');
    if(!lb) return;
    if(on()){
      lb.style.display='none';
      lo.style.display=''; li.style.display='';
      chip.style.display=''; chip.textContent = user.email || 'مستخدم';
      chip.title = 'مسجل الدخول';
    } else {
      lb.style.display=''; lo.style.display='none'; li.style.display='none'; chip.style.display='none';
    }
    setCloud(on() ? undefined : 'off');
  }

  /* ---------- الإقلاع ---------- */
  async function boot(){
    updateAuthUI();
    if(!cfgOK()) return;                 // لم تُضبط المفاتيح — وضع ضيف كامل كما هو
    if(!window.supabase) return;         // لا إنترنت — يعمل محلياً
    try{
      sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      enabled = true;
      const { data:{ session } } = await sb.auth.getSession();
      if(session && session.user){
        user = session.user;
        currentId = localStorage.getItem(CUR_KEY) || null;
        updateAuthUI();
        await loadLatest();
      }
      sb.auth.onAuthStateChange((ev, s) => {
        if(ev === 'SIGNED_OUT'){ user=null; currentId=null; localStorage.removeItem(CUR_KEY); updateAuthUI(); toast('🚪 تم تسجيل الخروج'); }
        if(ev === 'SIGNED_IN' && s && s.user){
          user = s.user; currentId = null; updateAuthUI();
          loadLatest().then(()=>toast('👋 مرحباً — جلساتك جاهزة'));
        }
      });
    }catch(e){ console.warn('LiqaaS boot:', e); }
  }

  /* ---------- لقطة البيانات من الواجهة ---------- */
  function snap(){
    const f = id => { const el = $(id); return el ? el.value.trim() : ''; };
    return {
      meeting: {
        title: f('title') || 'لقاء بدون عنوان',
        meeting_type: f('mtype'), meeting_date: f('date') || null,
        hijri_date: f('hijri'), meeting_time: f('time'),
        time_fmt: (window.timeFmt === '12') ? '12' : '24',
        place: f('place'), host: f('host'),
        quote_type: f('quoteType'), quote: f('quote'), notes: f('notes'),
        next_title: f('nextTitle'), next_date: f('nextDate') || null,
        attendees: JSON.parse(JSON.stringify(attendees || []))
      },
      items: (rows || []).map((r,i) => ({
        sort: i, topic: r.topic || '', mins: String(r.mins ?? ''),
        owner: r.owner || '', decision: r.decision || '',
        followup: r.followup || '', done: !!r.done
      }))
    };
  }

  /* ---------- الرفع / التحديث ---------- */
  function saveRemote(){
    if(!on()) return;
    setCloud('saving');
    clearTimeout(timer);
    timer = setTimeout(()=>{ doPush().catch(()=>{}); }, 1500);
  }

  async function doPush(){
    if(!on()) return;
    setCloud('saving');
    const s = snap();
    let id = currentId;
    if(id){
      const { error } = await sb.from('meetings').update(s.meeting).eq('id', id);
      if(error) throw error;
    } else {
      const { data, error } = await sb.from('meetings').insert(s.meeting).select('id').single();
      if(error) throw error;
      id = data.id; currentId = id;
      localStorage.setItem(CUR_KEY, id);
    }
    // استبدال المحاور (استراتيجية حذف-ثم-إدراج، بيانات محاور قليلة)
    const { error: dErr } = await sb.from('agenda_items').delete().eq('meeting_id', id);
    if(dErr) throw dErr;
    if(s.items.length){
      const { error: iErr } = await sb.from('agenda_items')
        .insert(s.items.map(it => ({ ...it, meeting_id: id })));
      if(iErr) throw iErr;
    }
    setCloud('saved');
  }

  /* ---------- تحميل أحدث جلسة عند الدخول ---------- */
  async function loadLatest(){
    try{
      const { data, error } = await sb.from('meetings')
        .select('id, updated_at').order('updated_at', { ascending:false }).limit(1);
      if(error) throw error;
      if(data && data.length){ await openMeeting(data[0].id, true); }
      else { await importLocalDraft(); }
    }catch(e){ toast('⚠️ تعذر تحميل جلساتك من السحابة'); console.warn(e); }
  }

  async function importLocalDraft(){
    try{
      const d = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if(d && ((d.title && d.title !== '') || (d.rows && d.rows.length))){
        await doPush();
        toast('☁️ تم استيراد جلستك المحلية إلى حسابك');
      }
    }catch(e){}
  }

  /* ---------- فتح جلسة محفوظة ---------- */
  async function openMeeting(id, silent){
    try{
      const { data: m, error: e1 } = await sb.from('meetings').select('*').eq('id', id).single();
      if(e1) throw e1;
      const { data: its } = await sb.from('agenda_items')
        .select('*').eq('meeting_id', id).order('sort', { ascending:true });
      rows = (its || []).map((r,i) => ({
        id: i+1, topic: r.topic || '', mins: String(r.mins ?? ''),
        owner: r.owner || '', decision: r.decision || '',
        followup: r.followup || '', done: !!r.done
      }));
      uid = rows.length;
      attendees = Array.isArray(m.attendees) ? m.attendees : [];
      const setF = (fid, v) => { if($(fid) && v !== null && v !== undefined) $(fid).value = v; };
      setF('title', m.title); setF('mtype', m.meeting_type); setF('host', m.host);
      setF('date', m.meeting_date); setF('hijri', m.hijri_date);
      $('hijriShow').textContent = m.hijri_date ? ('🌙 ' + m.hijri_date) : '';
      setF('time', m.meeting_time);
      if(typeof setTimeFmt === 'function') setTimeFmt(m.time_fmt === '12' ? '12' : '24');
      setF('place', m.place); setF('quoteType', m.quote_type);
      setF('quote', m.quote); setF('notes', m.notes);
      setF('nextTitle', m.next_title); setF('nextDate', m.next_date);
      currentId = id; localStorage.setItem(CUR_KEY, id);
      renderChips(); renderRows(); genSummary();
      if(!silent){ toast('📂 تم فتح الجلسة'); closeLib(); }
    }catch(e){ toast('⚠️ تعذر فتح الجلسة'); console.warn(e); }
  }

  /* ---------- مكتبة الجلسات ---------- */
  async function openLib(){
    if(!on()){ window.openAuth ? openAuth() : openAuthModal(); return; }
    $('libModal').style.display = 'flex';
    await refreshLib();
  }
  function closeLib(){ if($('libModal')) $('libModal').style.display = 'none'; }

  async function refreshLib(){
    const box = $('libList');
    if(!box) return;
    box.innerHTML = '<div class="empty">⏳ جارِ التحميل…</div>';
    try{
      const { data, error } = await sb.from('meetings')
        .select('id, title, meeting_type, updated_at')
        .order('updated_at', { ascending:false });
      if(error) throw error;
      if(!data || !data.length){
        box.innerHTML = '<div class="empty">لا توجد جلسات محفوظة بعد — الجلسة الحالية ستُحفظ تلقائياً ✨</div>';
        return;
      }
      box.innerHTML = data.map(g => `
        <div class="lib-item">
          <div class="li-info">
            <b>${esc(g.title)}</b>
            <span>${esc(g.meeting_type || '')} · ${new Date(g.updated_at).toLocaleString('ar',{dateStyle:'medium',timeStyle:'short'})}</span>
          </div>
          <div class="li-actions">
            <button class="btn btn-primary btn-sm" onclick="LiqaaS.openMeeting('${g.id}')">📂 فتح</button>
            <button class="btn btn-danger btn-sm" onclick="LiqaaS.deleteMeeting('${g.id}')">🗑️</button>
          </div>
        </div>`).join('');
    }catch(e){ box.innerHTML = '<div class="empty">⚠️ تعذر تحميل القائمة</div>'; }
  }

  async function deleteMeeting(id){
    if(!confirm('حذف هذه الجلسة نهائياً؟')) return;
    try{
      const { error } = await sb.from('meetings').delete().eq('id', id);
      if(error) throw error;
      if(id === currentId){ currentId = null; localStorage.removeItem(CUR_KEY); }
      toast('🗑️ حُذفت الجلسة'); refreshLib();
    }catch(e){ toast('⚠️ تعذر الحذف'); }
  }

  async function saveAsCopy(){
    if(!on()){ toast('🔑 سجّل الدخول أولاً'); return; }
    currentId = null; localStorage.removeItem(CUR_KEY);
    try{ await doPush(); toast('💾 حُفظت نسخة جديدة في جلساتك'); refreshLib(); }
    catch(e){}
  }

  async function newMeeting(){
    currentId = null; localStorage.removeItem(CUR_KEY);
    closeLib();
    if(typeof window.clearAll === 'function'){ window.clearAll(); }
    else { toast('🆕 جلسة جديدة'); }
    setTimeout(()=>{ const t=$('title'); if(t) t.focus(); }, 80);
  }

  /* ---------- المصادقة ---------- */
  function openAuthModal(){
    if($('authModal')){ $('authModal').style.display='flex'; setTab('in'); }
  }
  function openAuth(){
    if(!cfgOK()){ toast('⚠️ اضبط مفاتيح Supabase في ملف supabase-config.js أولاً'); return; }
    if(!window.supabase){ toast('⚠️ تحتاج اتصالاً بالإنترنت للدخول'); return; }
    openAuthModal();
  }
  function closeAuth(){ if($('authModal')) $('authModal').style.display='none'; }
  function setTab(t){
    authTab = t;
    $('tabIn').classList.toggle('on', t==='in');
    $('tabUp').classList.toggle('on', t==='up');
    $('pwLbl').textContent = (t==='in') ? 'كلمة المرور' : 'كلمة المرور (6 أحرف فأكثر)';
    $('authPw').setAttribute('autocomplete', (t==='in') ? 'current-password' : 'new-password');
    $('authSubmit').textContent  = (t==='in') ? '🔑 دخول' : '✨ إنشاء الحساب';
    $('authMsg').textContent = '';
  }
  function trErr(m){
    const map = {
      'Invalid login credentials': 'البريد أو كلمة المرور غير صحيحة',
      'Email not confirmed': 'لم يتم تأكيد البريد — راجع صندوق الوارد وفتّش عن رسالة Confirm your signup',
      'User already registered': 'هذا البريد مسجل مسبقاً — جرّب تسجيل الدخول',
      'Password should be at least 6 characters': 'كلمة المرور 6 أحرف على الأقل',
      'Unable to validate email address: invalid format': 'صيغة البريد غير صحيحة'
    };
    for(const k in map) if(m && m.includes(k)) return map[k];
    return m || 'خطأ غير متوقع';
  }
  function setBusy(b){
    const btn = $('authSubmit');
    if(btn){ btn.disabled = b; btn.textContent = b ? '⏳ لحظة…' : (authTab==='in' ? '🔑 دخول' : '✨ إنشاء الحساب'); }
  }
  async function submitAuth(){
    if(!enabled || !sb){ $('authMsg').textContent = '⚠️ Supabase غير مضبوط أو يتعذر الوصول — تحقق من المفاتيح والإنترنت'; return; }
    const email = $('authEmail').value.trim(), pw = $('authPw').value;
    if(!email || pw.length < 6){ $('authMsg').textContent = '⚠️ أدخل بريداً صحيحاً وكلمة مرور 6 أحرف فأكثر'; return; }
    setBusy(true);
    try{
      if(authTab === 'in'){
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if(error) throw error;
      } else {
        const { data, error } = await sb.auth.signUp({ email, password: pw });
        if(error) throw error;
        if(!data.session){
          $('authMsg').textContent = '✉️ أُنشئ الحساب — راجع بريدك لتأكيده ثم سجّل الدخول';
          setBusy(false); return;
        }
      }
      closeAuth();
      $('authEmail').value = ''; $('authPw').value = '';
    }catch(e){
      $('authMsg').textContent = '⚠️ ' + trErr(e.message || '');
    }
    setBusy(false);
  }
  async function signOut(){
    if(!sb) return;
    await sb.auth.signOut();
    user = null; currentId = null; localStorage.removeItem(CUR_KEY);
    updateAuthUI();
    toast('🚪 تم الخروج — بياناتك تُحفظ محلياً (وضع الضيف)');
  }

  /* إغلاق النوافذ بمفتاح Escape */
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ closeAuth(); closeLib(); }
  });

  return {
    boot, saveRemote,
    openAuth, closeAuth, setTab, submitAuth, signOut,
    openLib, closeLib, refreshLib,
    openMeeting, deleteMeeting, saveAsCopy, newMeeting,
    isOn: on
  };
})();
