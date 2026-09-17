(()=>{
  const originalWrite=document.write.bind(document);
  document.write=function(html){
    if(typeof html==='string'&&html.includes('Birthday Site Control Room')){
      const addon=`
<style>
.security-wrap{max-width:760px}.security-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}.security-card h3{font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 15px;color:#d5d8de}.security-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.security-message{min-height:18px;margin-top:10px;font-size:11px;color:var(--muted)}.security-message.good{color:#7fe0a3}.security-message.bad{color:#ff9b9b}.security-note{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:11px;background:#111318;color:var(--muted);font-size:11px}@media(max-width:700px){.security-grid{grid-template-columns:1fr}}
</style>
<section class="view" id="view-security">
  <div class="pagehead"><div><h2>Security</h2><p>Change the private key used to unlock this Control Room, publish changes, and upload media.</p></div></div>
  <div class="security-wrap">
    <div class="security-card">
      <h3>Admin key</h3>
      <div class="security-grid">
        <div class="field"><label>New admin key</label><input id="newAdminKey" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
        <div class="field"><label>Confirm new key</label><input id="confirmAdminKey" type="password" autocomplete="new-password" placeholder="Type it again"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn primary" type="button" id="changeAdminKey">Change admin key</button><button class="btn" type="button" id="toggleAdminKeys">Show keys</button></div>
      <div class="security-message" id="adminKeyMessage"></div>
      <div class="security-note">Changing the key takes effect immediately. The old key will stop working for publishing and media uploads on every device.</div>
    </div>
  </div>
</section>
<script>
(()=>{
  const nav=document.getElementById('nav');
  if(nav&&!nav.querySelector('[data-view="security"]')){
    const b=document.createElement('button');b.dataset.view='security';b.textContent='Security';nav.appendChild(b);
  }
  const next=document.getElementById('newAdminKey'),confirm=document.getElementById('confirmAdminKey'),msg=document.getElementById('adminKeyMessage'),button=document.getElementById('changeAdminKey'),toggle=document.getElementById('toggleAdminKeys');
  if(!next||!confirm||!button)return;
  function message(text,type){msg.textContent=text;msg.className='security-message'+(type?' '+type:'')}
  toggle?.addEventListener('click',()=>{const show=next.type==='password';next.type=confirm.type=show?'text':'password';toggle.textContent=show?'Hide keys':'Show keys'});
  async function ping(key){
    const r=await fetch('https://aaimjubffhdujevrdamo.supabase.co/functions/v1/birthday-site-admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({action:'ping'})});
    return r.ok;
  }
  button.addEventListener('click',async()=>{
    const newKey=next.value;
    const again=confirm.value;
    if(newKey.length<8){message('Use at least 8 characters.','bad');next.focus();return}
    if(newKey.length>128){message('Keep the key under 128 characters.','bad');next.focus();return}
    if(newKey!==again){message('The two keys do not match.','bad');confirm.focus();return}
    const current=sessionStorage.getItem('birthday-admin-key')||'';
    if(!current){message('Unlock the Control Room again before changing the key.','bad');return}
    button.disabled=true;message('Changing key…');
    try{
      const r=await fetch('https://aaimjubffhdujevrdamo.supabase.co/functions/v1/birthday-site-admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':current},body:JSON.stringify({action:'change_key',newKey})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Could not change admin key');
      if(!(await ping(newKey)))throw new Error('The new key could not be verified');
      sessionStorage.setItem('birthday-admin-key',newKey);
      try{ADMIN_KEY=newKey}catch(e){}
      next.value='';confirm.value='';next.type=confirm.type='password';if(toggle)toggle.textContent='Show keys';
      message('Admin key changed. The old key is no longer valid.','good');
      if(typeof toast==='function')toast('Admin key changed');
    }catch(e){message(e?.message||String(e),'bad')}
    finally{button.disabled=false}
  });
})();
</script>`;
      const i=html.toLowerCase().lastIndexOf('</body>');
      html=i>=0?html.slice(0,i)+addon+html.slice(i):html+addon;
    }
    return originalWrite(html);
  };
})();
