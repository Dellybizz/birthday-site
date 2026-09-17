const ROUTES = new Set([
  'index.html',
  'entry.html',
  'memories.html',
  'pretty-photos.html',
  'heart.html',
  'yapping.html',
  'fair.html',
  'countdown.html',
  'finale.html',
  'control.html'
]);

const params = new URLSearchParams(location.search);
const adminPreview = params.get('adminPreview') === '1';
const raw = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
let page = ROUTES.has(raw) ? raw : 'index.html';

if (page === 'entry.html') page = 'index.html';
else if (page === 'index.html' && !adminPreview) page = 'countdown.html';

const sourcePage = page;
const base = 'https://aaimjubffhdujevrdamo.supabase.co/storage/v1/object/public/birthday-site-web/';

function injectBeforeBody(html, extra) {
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i >= 0 ? html.slice(0, i) + extra + html.slice(i) : html + extra;
}

function insertedMediaRuntime(pageName) {
  return `
<style>
.bday-added-photo{display:block;max-width:min(100%,560px);height:auto;margin:20px auto;border-radius:18px;object-fit:cover;box-shadow:0 16px 50px rgba(0,0,0,.14)}
</style>
<script>
(()=>{
  const PAGE=${JSON.stringify(pageName)};
  async function readLive(){
    try{if(window.BDAY?.fetchRemote)return (await window.BDAY.fetchRemote()).state}catch(e){}
    try{if(window.BDAY?.read)return window.BDAY.read()}catch(e){}
    return window.SITE_CONFIG||{};
  }
  function addOne(anchor,item){
    if(!anchor||!item?.url)return;
    const img=document.createElement('img');
    img.src=item.url;img.alt=item.alt||'';img.className='bday-added-photo';
    img.dataset.bdayInserted=item.id||item.url;
    if(item.placement==='inside') anchor.appendChild(img);
    else if(item.placement==='before') anchor.parentNode?.insertBefore(img,anchor);
    else anchor.parentNode?.insertBefore(img,anchor.nextSibling);
  }
  async function apply(){
    const st=await readLive();
    const patches=st?.patches?.[PAGE]||[];
    for(const p of patches){
      if(!Array.isArray(p.insertImages)||!p.insertImages.length)continue;
      const anchor=document.querySelector(p.selector);if(!anchor)continue;
      for(const item of p.insertImages){
        if(document.querySelector('[data-bday-inserted="'+CSS.escape(item.id||item.url)+'"]'))continue;
        addOne(anchor,item);
      }
    }
  }
  setTimeout(apply,80);
})();
</script>`;
}

function countdownLockEnhancement() {
  return `
<style>
#next{display:none!important}
.bday-lock-wrap{display:grid;place-items:center;margin:28px auto 0;gap:12px}
.bday-lock{width:94px;height:94px;border-radius:50%;border:1px solid #cfc8bc;background:rgba(255,255,255,.22);display:grid;place-items:center;transition:.35s ease;position:relative;color:#504a44}
.bday-lock svg{width:38px;height:38px;stroke:currentColor;fill:none;stroke-width:1.6}
.bday-lock.ready{cursor:pointer;background:#151413;color:#f4f1eb;border-color:#151413;box-shadow:0 18px 55px rgba(20,19,18,.18);transform:translateY(-2px)}
.bday-lock.ready:hover{transform:translateY(-4px) scale(1.02)}
.bday-lock-label{font:9px/1.4 Arial,sans-serif;letter-spacing:.17em;text-transform:uppercase;color:#777069}
.bday-lock-note{font:12px/1.6 Georgia,serif;color:#746d66;max-width:420px}
.lock-modal{position:fixed;inset:0;z-index:9999;background:rgba(20,19,18,.74);backdrop-filter:blur(12px);display:none;place-items:center;padding:22px}
.lock-modal.open{display:grid}
.lock-card{width:min(430px,100%);background:#f1eee7;color:#151413;border:1px solid #cfc8bc;border-radius:24px;padding:28px;text-align:center;box-shadow:0 26px 80px rgba(0,0,0,.25)}
.lock-card small{display:block;font:9px Arial,sans-serif;letter-spacing:.17em;text-transform:uppercase;color:#888078;margin-bottom:10px}
.lock-card h2{font:400 32px/1 Georgia,serif;margin:0 0 8px}
.lock-card p{font:13px/1.65 Georgia,serif;color:#746d66;margin:0 0 18px}
.lock-code{width:100%;text-align:center;font:30px/1.2 'Courier New',monospace;letter-spacing:.35em;padding:14px 10px;border:1px solid #cfc8bc;background:#fffdf8;color:#151413;border-radius:13px;outline:none}
.lock-code:focus{border-color:#70675f}
.lock-actions{display:flex;gap:9px;margin-top:12px}.lock-actions button{flex:1;border:1px solid #cfc8bc;background:transparent;color:#151413;border-radius:12px;padding:12px;cursor:pointer;font:10px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.lock-actions .go{background:#151413;color:#fff;border-color:#151413}
.lock-error{min-height:18px;margin-top:10px!important;color:#8c403d!important;font-family:Arial,sans-serif!important;font-size:11px!important}
@media(max-width:640px){.bday-lock{width:80px;height:80px}.lock-card{padding:23px}.lock-card h2{font-size:28px}.lock-code{font-size:27px}}
</style>
<script>
(async()=>{
  const PASSWORD='200905';
  const preview=new URLSearchParams(location.search).get('adminPreview')==='1';
  let cfg=window.SITE_CONFIG||{};
  try{if(window.BDAY?.fetchRemote){const r=await window.BDAY.fetchRemote();cfg={...cfg,...(r.state?.general||{})}}}catch(e){}
  const fallback='2026-09-20T00:00:00+05:30';
  const parsed=new Date(cfg.birthdayISO||fallback);
  const target=isNaN(parsed)?new Date(fallback):parsed;
  const sub=document.getElementById('sub');
  const chapter=document.querySelector('.chapter');
  const inner=document.querySelector('.inner');
  if(chapter)chapter.textContent='birthday lock · first screen';
  const oldPreview=document.getElementById('preview');if(oldPreview)oldPreview.textContent='';
  const oldNext=document.getElementById('next');if(oldNext)oldNext.remove();
  const wrap=document.createElement('div');wrap.className='bday-lock-wrap';
  wrap.innerHTML='<button class="bday-lock" id="birthdayLock" type="button" aria-label="Birthday lock" disabled><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="21" width="28" height="20" rx="6"></rect><path d="M16 21v-7a8 8 0 0 1 16 0v7"></path><circle cx="24" cy="31" r="2.2"></circle></svg></button><div class="bday-lock-label" id="lockLabel">locked until her birthday</div><div class="bday-lock-note" id="lockNote">The timer is the key. When it reaches zero, the lock can finally be opened.</div>';
  inner?.appendChild(wrap);
  const modal=document.createElement('div');modal.className='lock-modal';modal.id='lockModal';
  modal.innerHTML='<div class="lock-card"><small>birthday access</small><h2>come on! you know the password</h2><p>Six digits. You definitely know this one.</p><input class="lock-code" id="lockCode" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="••••••" aria-label="Six digit password"><div class="lock-actions"><button type="button" id="lockCancel">not yet</button><button class="go" type="button" id="lockGo">unlock</button></div><p class="lock-error" id="lockError"></p></div>';
  document.body.appendChild(modal);
  const button=document.getElementById('birthdayLock'),label=document.getElementById('lockLabel'),note=document.getElementById('lockNote'),code=document.getElementById('lockCode'),error=document.getElementById('lockError');
  function ready(){return preview||Date.now()>=target.getTime()}
  function sync(){
    const isReady=ready();button.disabled=!isReady;button.classList.toggle('ready',isReady);
    label.textContent=isReady?'unlock':'locked until her birthday';
    note.textContent=isReady?'The wait is over. One tiny password check and the rest is yours.':'The timer is the key. When it reaches zero, the lock can finally be opened.';
    if(isReady&&sub)sub.textContent='The countdown is over. The lock is ready.';
  }
  sync();setInterval(sync,500);
  button.addEventListener('click',()=>{if(!ready())return;modal.classList.add('open');code.value='';error.textContent='';setTimeout(()=>code.focus(),50)});
  document.getElementById('lockCancel').addEventListener('click',()=>modal.classList.remove('open'));
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
  function submit(){
    const v=code.value.replace(/\D/g,'').slice(0,6);code.value=v;
    if(v===PASSWORD){localStorage.setItem('birthdayUnlocked','1');location.href='entry.html';return}
    error.textContent='come on! you know the password';
    code.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(0)'}],{duration:260});
    code.select();
  }
  code.addEventListener('input',()=>{code.value=code.value.replace(/\D/g,'').slice(0,6);error.textContent=''});
  code.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
  document.getElementById('lockGo').addEventListener('click',submit);
})();
</script>`;
}

function controlRoomEnhancement(html) {
  html = html.replace(
    "if(!el)return;e.preventDefault();e.stopPropagation();selectElement(el)",
    "if(window.__previewInteractMode)return;if(!el)return;e.preventDefault();e.stopPropagation();selectElement(el)"
  );
  const addon = `
<style>
.preview-mode{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}.preview-mode button{border:0;background:#101217;color:#9298a3;padding:8px 10px;cursor:pointer;font-size:10px}.preview-mode button.active{background:#f5f5f4;color:#111}.date-easy{display:grid;grid-template-columns:1.2fr .8fr;gap:10px}.date-easy input{width:100%;border:1px solid var(--line);background:#101217;color:#f5f5f5;padding:10px 11px;border-radius:9px;color-scheme:dark}.add-photo-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin:10px 0 14px}.add-photo-row select{border:1px solid var(--line);background:#101217;color:#fff;padding:10px;border-radius:9px}.add-photo-row label{position:relative;overflow:hidden}.add-photo-row input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}.editor-tip{font-size:10px;color:#7f8590;margin:-5px 0 10px}.photo-mini{display:none}.photo-mini.show{display:block;margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:10px;color:#aeb3bd;font-size:10px}@media(max-width:600px){.date-easy{grid-template-columns:1fr}.add-photo-row{grid-template-columns:1fr}}
</style>
<script>
(()=>{
  window.__previewInteractMode=false;
  const dateSource=document.querySelector('[data-bind="general.birthdayISO"]');
  if(dateSource){
    const field=dateSource.closest('.field');
    dateSource.style.display='none';
    const easy=document.createElement('div');easy.className='date-easy';
    easy.innerHTML='<div><label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#8d929d;margin-bottom:6px">Birthday date</label><input type="date" id="easyBirthdayDate"></div><div><label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#8d929d;margin-bottom:6px">Time</label><input type="time" id="easyBirthdayTime" step="60"></div>';
    field.appendChild(easy);
    const d=easy.querySelector('#easyBirthdayDate'),t=easy.querySelector('#easyBirthdayTime');
    function load(){const iso=state?.general?.birthdayISO||'2026-09-20T00:00:00+05:30';const m=iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);if(m){d.value=m[1];t.value=m[2]}}
    function commit(){if(!d.value)return;const time=t.value||'00:00';state.general.birthdayISO=d.value+'T'+time+':00+05:30';dateSource.value=state.general.birthdayISO;dirty()}
    d.addEventListener('input',commit);t.addEventListener('input',commit);load();
    const originalRenderAll=renderAll;renderAll=function(){originalRenderAll();load()};
    const hint=document.createElement('div');hint.className='help';hint.style.marginTop='7px';hint.textContent='Uses India time (IST). Pick the date and time normally — no ISO formatting needed.';field.appendChild(hint);
  }
  const bar=document.querySelector('.previewbar');
  if(bar){
    const group=document.createElement('div');group.className='preview-mode';
    group.innerHTML='<button type="button" class="active" id="modeEdit">Edit</button><button type="button" id="modeInteract">Interact</button>';
    const spacer=bar.querySelector('.spacer');bar.insertBefore(group,spacer||null);
    const edit=group.querySelector('#modeEdit'),interact=group.querySelector('#modeInteract');
    function setMode(v){window.__previewInteractMode=v;edit.classList.toggle('active',!v);interact.classList.toggle('active',v);const box=document.getElementById('selectorBox');if(v)box.textContent='Interact mode — links and buttons work normally.';else if(!selected)box.textContent='Click something in the preview.'}
    edit.onclick=()=>setMode(false);interact.onclick=()=>setMode(true);
  }
  const inspector=document.querySelector('.inspector');
  const selectorBox=document.getElementById('selectorBox');
  if(inspector&&selectorBox){
    const tip=document.createElement('div');tip.className='editor-tip';tip.textContent='Edit mode selects elements. Interact mode lets you use the page normally and move to the next screen.';selectorBox.after(tip);
    const row=document.createElement('div');row.className='add-photo-row';
    row.innerHTML='<div><label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#8d929d;margin-bottom:6px">Add photo placement</label><select id="photoPlacement"><option value="after">After selected element</option><option value="inside">Inside selected element</option><option value="before">Before selected element</option></select></div><label class="btn primary" style="text-align:center">+ Add photo<input id="visualPhotoUpload" type="file" accept="image/*"></label>';
    tip.after(row);
    const status=document.createElement('div');status.className='photo-mini';row.after(status);
    row.querySelector('#visualPhotoUpload').onchange=async e=>{
      const file=e.target.files?.[0];if(!file)return;
      if(!selected){status.className='photo-mini show';status.textContent='Select where the photo should go first.';e.target.value='';return}
      try{
        status.className='photo-mini show';status.textContent='Uploading '+file.name+'…';
        const url=await addMedia(file);
        const page=document.getElementById('previewPage').value;state.patches[page]??=[];
        let p=state.patches[page].find(x=>x.selector===selected.selector);
        if(!p){p={selector:selected.selector,styles:{}};state.patches[page].push(p)}
        p.insertImages??=[];p.insertImages.push({id:'img-'+Date.now().toString(36),url,placement:row.querySelector('#photoPlacement').value,alt:''});
        dirty();await save();status.textContent='Photo added and published.';reloadPreview();
      }catch(err){status.textContent=err.message||'Upload failed'}finally{e.target.value=''}
    };
  }
  const frame=document.getElementById('previewFrame');
  frame?.addEventListener('load',()=>{
    if(!window.__previewInteractMode)return;
    try{const name=frame.contentWindow.location.pathname.split('/').filter(Boolean).pop()||'index.html';const select=document.getElementById('previewPage');if([...select.options].some(o=>o.value===name)){select.value=name}}catch(e){}
  });
})();
</script>`;
  return injectBeforeBody(html, addon);
}

fetch(base + encodeURIComponent(sourcePage), { cache: 'no-store' })
  .then(r => {
    if (!r.ok) throw new Error('Could not open this page.');
    return r.text();
  })
  .then(html => {
    if (sourcePage === 'control.html') html = controlRoomEnhancement(html);
    else {
      // Media/text/visibility patches are handled only by page-patch-runtime.js.
      if (sourcePage === 'countdown.html') html = injectBeforeBody(html, countdownLockEnhancement());
    }
    document.open();
    document.write(html);
    document.close();
  })
  .catch(err => {
    const boot = document.getElementById('boot');
    if (boot) boot.textContent = err.message;
  });
