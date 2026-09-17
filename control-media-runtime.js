(()=>{
  const MEDIA_ENDPOINT='https://aaimjubffhdujevrdamo.supabase.co/functions/v1/birthday-site-media';
  const TRANSIENT=/\.(?:visible|active|open|shown|show|entered|in-view|is-visible|revealed)\b/g;
  let mediaItems=[];
  let selectedSignature='';
  let undoStack=[],redoStack=[],historyBusy=false;
  const historyLimit=40;
  const cloneState=value=>JSON.parse(JSON.stringify(value));
  function historySnapshot(){return cloneState(state)}
  function updateHistoryButtons(){
    const u=document.getElementById('veUndo'),r=document.getElementById('veRedo');
    if(u)u.disabled=!undoStack.length||historyBusy;
    if(r)r.disabled=!redoStack.length||historyBusy;
  }
  function pushHistory(snapshot){
    if(historyBusy)return;
    undoStack.push(snapshot||historySnapshot());
    if(undoStack.length>historyLimit)undoStack.shift();
    redoStack=[];
    updateHistoryButtons();
  }
  async function restoreHistoryState(next){
    if(!next||historyBusy)return;
    historyBusy=true;updateHistoryButtons();
    const keepPage=pageName(),keepSelector=selected?.selector||'';
    state=cloneState(next);
    dirty();
    try{
      await save();
      if(typeof renderAll==='function')renderAll();
      const pageSelect=document.getElementById('previewPage');
      if(pageSelect&&[...pageSelect.options].some(o=>o.value===keepPage))pageSelect.value=keepPage;
      reloadPreview();
      setTimeout(()=>{
        try{
          if(!keepSelector)return;
          const d=document.getElementById('previewFrame')?.contentDocument;
          const el=d?.querySelector(keepSelector);
          if(el&&typeof selectElement==='function')selectElement(el);
        }catch(e){}
      },500);
    }finally{historyBusy=false;updateHistoryButtons()}
  }
  async function undoEditor(){
    if(!undoStack.length||historyBusy)return;
    const current=historySnapshot(),previous=undoStack.pop();
    redoStack.push(current);
    await restoreHistoryState(previous);
  }
  async function redoEditor(){
    if(!redoStack.length||historyBusy)return;
    const current=historySnapshot(),next=redoStack.pop();
    undoStack.push(current);
    await restoreHistoryState(next);
  }

  const style=document.createElement('style');
  style.textContent=`
.shared-media-note{margin-bottom:14px;padding:12px 14px;border:1px solid var(--line);background:#111318;border-radius:11px;color:#aeb3bd;font-size:11px}
.media-refresh{margin-left:8px}
.hide-tools{margin:12px 0 14px;padding:12px;border:1px solid var(--line);background:#111318;border-radius:12px}.hide-tools-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hide-tools-status{margin-top:8px;color:var(--muted);font-size:10px;min-height:15px}.hidden-list{display:grid;gap:7px;margin-top:10px}.hidden-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:9px;background:#0f1115}.hidden-item code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aeb3bd;font-size:10px}.hidden-empty{color:#717783;font-size:10px;padding:6px 0}
.media-target-tools{display:none;margin:12px 0 14px;padding:12px;border:1px solid var(--line);background:#111318;border-radius:12px}.media-target-tools.show{display:block}.media-target-tools h4{margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#d5d8de}.media-target-row{display:none!important}.media-target-row select{width:100%;border:1px solid var(--line);background:#101217;color:#fff;padding:10px;border-radius:9px}.media-target-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.media-target-actions label{position:relative;overflow:hidden}.media-target-actions input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}.media-target-status{margin-top:8px;color:#aeb3bd;font-size:10px;min-height:15px}.media-target-meta{margin:0 0 10px;color:#858b96;font-size:10px}.media-target-placement{display:none!important}.attached-media-list{display:none!important}.hide-tools{display:none!important}.attached-media-item{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:7px;border:1px solid var(--line);border-radius:9px}.attached-media-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9da3ae;font-size:10px}
@media(max-width:600px){.media-target-row,.hidden-item{grid-template-columns:1fr}.media-refresh{margin-left:0}}
`;
  document.head.appendChild(style);

  function adminKey(){return sessionStorage.getItem('birthday-admin-key')||''}
  function pageName(){return document.getElementById('previewPage')?.value||'index.html'}
  function stableSelector(selector){return String(selector||'').replace(TRANSIENT,'')}
  function patchFor(selector){
    const page=pageName();state.patches[page]??=[];
    const stable=stableSelector(selector);
    let patch=state.patches[page].find(p=>stableSelector(p?.selector)===stable);
    if(!patch){patch={selector:stable,styles:{}};state.patches[page].push(patch)}
    else if(patch.selector!==stable)patch.selector=stable;
    return patch;
  }
  function previewElement(){
    if(!selected?.selector)return null;
    const doc=document.getElementById('previewFrame')?.contentDocument;
    if(!doc)return null;
    for(const selector of [selected.selector,stableSelector(selected.selector),stableSelector(selected.selector).replace(/:nth-of-type\(\d+\)/g,'')]){
      try{const el=doc.querySelector(selector);if(el)return el}catch(e){}
    }
    return null;
  }
  function isMediaTarget(){
    if(!selected?.selector)return false;
    if(['img','video','audio','source','picture'].includes(selected.tag))return true;
    const el=previewElement();if(!el)return false;
    const signature=((el.id||'')+' '+(el.className||'')).toLowerCase();
    if(/photo|image|media|visual|polaroid|gallery|poster|picture|pic|frame|shot|avatar|placeholder/.test(signature))return true;
    return !!el.querySelector?.('img,video,audio,source,picture,[class*="photo"],[class*="image"],[class*="media"]');
  }
  function targetIsDirectMedia(){return ['img','video','audio','source'].includes(selected?.tag)}

  async function sharedMedia(){
    const key=adminKey();
    if(!key)throw new Error('Unlock the Control Room first.');
    const r=await fetch(MEDIA_ENDPOINT+'?folder=birthday-site',{headers:{'x-admin-key':key},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Could not load shared media');
    mediaItems=Array.isArray(j.items)?j.items:[];
    return mediaItems;
  }

  async function uploadShared(file){
    const key=adminKey();
    if(!key)throw new Error('Unlock the Control Room first.');
    const fd=new FormData();fd.append('file',file);fd.append('folder','birthday-site');
    const r=await fetch(MEDIA_ENDPOINT,{method:'POST',headers:{'x-admin-key':key},body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Upload failed');
    return {name:j.name||file.name,type:j.type||file.type,size:j.size||file.size,url:j.url,path:j.path||''};
  }

  function mediaPreview(rec){
    const u=rec.url||'';const type=String(rec.type||'');
    if(type.startsWith('image/')||!type)return '<img src="'+u+'" alt="">';
    if(type.startsWith('video/'))return '<video src="'+u+'" muted playsinline></video>';
    if(type.startsWith('audio/'))return '<audio controls src="'+u+'"></audio>';
    return '<div style="padding:18px">file</div>';
  }

  async function renderSharedMedia(){
    const box=document.getElementById('mediaGrid');if(!box)return;
    box.innerHTML='<div class="empty">Loading shared media…</div>';
    try{
      const items=await sharedMedia();box.innerHTML='';
      if(!items.length){box.innerHTML='<div class="empty">Upload a photo, video or audio file. Files uploaded here are shared across devices.</div>';return}
      items.forEach(rec=>{
        const c=document.createElement('div');c.className='media-card';
        c.innerHTML='<div class="media-thumb">'+mediaPreview(rec)+'</div><div class="media-meta"><b></b><small></small><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn" data-copy type="button">Copy URL</button></div></div>';
        c.querySelector('b').textContent=rec.name||rec.path||'media';c.querySelector('small').textContent=rec.url||'';
        c.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(rec.url||'');toast?.('URL copied')}catch(e){prompt('Copy media URL',rec.url||'')}};
        box.appendChild(c);
      });
    }catch(e){box.innerHTML='<div class="empty">Could not load media: '+String(e?.message||e).replace(/[<>]/g,'')+'</div>'}
  }

  try{renderMedia=renderSharedMedia}catch(e){window.renderMedia=renderSharedMedia}
  try{listMedia=sharedMedia}catch(e){window.listMedia=sharedMedia}

  const mediaView=document.getElementById('view-media');
  if(mediaView){
    const p=mediaView.querySelector('.pagehead p');if(p)p.innerHTML='Upload photos, video and audio to the <b>shared live media library</b>. Then choose them from media-enabled sections in the Visual Editor.';
    const oldWarn=mediaView.querySelector('.warn');if(oldWarn){oldWarn.className='shared-media-note';oldWarn.textContent='Media is stored in Supabase and synced across devices. Upload once, then select it from any media-enabled section.'}
    const oldInput=document.getElementById('mediaUpload');
    if(oldInput){
      const fresh=oldInput.cloneNode(true);oldInput.replaceWith(fresh);
      fresh.addEventListener('change',async()=>{
        const files=[...(fresh.files||[])];if(!files.length)return;
        try{for(const file of files){toast?.('Uploading '+file.name+'…');await uploadShared(file)}toast?.('Media uploaded');await renderSharedMedia();await refreshMediaPicker()}catch(e){alert(e?.message||String(e))}finally{fresh.value=''}
      });
    }
    const upload=mediaView.querySelector('.pagehead .upload');
    if(upload&&!mediaView.querySelector('#refreshMediaLibrary')){
      const refresh=document.createElement('button');refresh.type='button';refresh.id='refreshMediaLibrary';refresh.className='btn media-refresh';refresh.textContent='Refresh library';upload.after(refresh);
      refresh.onclick=async()=>{refresh.disabled=true;await renderSharedMedia();await refreshMediaPicker();refresh.disabled=false};
    }
  }

  document.querySelectorAll('.add-photo-row,.photo-mini').forEach(el=>el.remove());

  const inspector=document.querySelector('.inspector');
  const fields=document.getElementById('inspectorFields');
  if(inspector&&fields){
    const mediaPanel=document.createElement('div');mediaPanel.id='mediaTargetTools';mediaPanel.className='media-target-tools';
    mediaPanel.innerHTML='<h4>Media</h4><div class="media-target-meta" id="mediaTargetMeta">Choose existing media or upload a new file for this section.</div><div class="media-target-row"><div><label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#8d929d;margin-bottom:6px">Select media</label><select id="existingMediaSelect"><option value="">Loading library…</option></select></div><button class="btn primary" id="useExistingMedia" type="button">Use selected</button></div><div class="media-target-placement"><label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#8d929d;margin-bottom:6px">Placement</label><select id="mediaPlacement" style="width:100%;border:1px solid var(--line);background:#101217;color:#fff;padding:10px;border-radius:9px"><option value="replace">Replace media slot</option><option value="inside">Inside selected section</option><option value="after">After selected section</option><option value="before">Before selected section</option></select></div><div class="media-target-actions"><label class="btn primary">+ Add media<input id="addMediaToSelection" type="file" accept="image/*,video/*,audio/*"></label><button class="btn" id="refreshMediaPicker" type="button">Refresh media</button></div><div class="media-target-status" id="mediaTargetStatus"></div><div class="attached-media-list" id="attachedMediaList"></div>';
    fields.before(mediaPanel);

    const hidePanel=document.createElement('div');hidePanel.id='hideTools';hidePanel.className='hide-tools';
    hidePanel.innerHTML='<div class="hide-tools-row"><button type="button" class="btn danger" id="hideSelectedElement">Hide selected</button><button type="button" class="btn" id="refreshHiddenList">Hidden elements</button></div><div class="hide-tools-status" id="hideToolsStatus">Select an element in Edit mode, then hide it from the live page.</div><div class="hidden-list" id="hiddenElementsList"></div>';
    mediaPanel.before(hidePanel);

    const mediaStatus=mediaPanel.querySelector('#mediaTargetStatus');
    const select=mediaPanel.querySelector('#existingMediaSelect');
    const placement=mediaPanel.querySelector('#mediaPlacement');
    const attached=mediaPanel.querySelector('#attachedMediaList');

    window.refreshMediaPicker=async function(){
      try{
        const items=await sharedMedia();const current=select.value;select.innerHTML='<option value="">Select an uploaded file…</option>';
        items.forEach((rec,index)=>{const o=document.createElement('option');o.value=String(index);o.textContent=rec.name||rec.path||('Media '+(index+1));select.appendChild(o)});
        if([...select.options].some(o=>o.value===current))select.value=current;
      }catch(e){select.innerHTML='<option value="">Could not load media</option>';mediaStatus.textContent=e?.message||String(e)}
    };

    function currentPatch(){
      if(!selected?.selector)return null;
      const stable=stableSelector(selected.selector);return (state.patches[pageName()]||[]).find(p=>stableSelector(p?.selector)===stable)||null;
    }
    function renderAttached(){
      attached.innerHTML='';const patch=currentPatch();const list=Array.isArray(patch?.insertImages)?patch.insertImages:[];
      if(!list.length)return;
      list.forEach((item,index)=>{
        const row=document.createElement('div');row.className='attached-media-item';const name=document.createElement('span');name.textContent=item.name||item.url||('Media '+(index+1));
        const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remove';remove.onclick=async()=>{list.splice(index,1);dirty();mediaStatus.textContent='Removing…';try{await save();mediaStatus.textContent='Removed and published.';reloadPreview();renderAttached()}catch(e){mediaStatus.textContent=e?.message||String(e)}};row.append(name,remove);attached.appendChild(row);
      });
    }

    function updateMediaPanel(){
      const capable=isMediaTarget();mediaPanel.classList.toggle('show',capable);
      hidePanel.style.display=selected?.selector?'block':'none';
      if(capable){
        const el=previewElement();const signature=((el?.id||'')+' '+(el?.className||'')).toLowerCase();
        placement.value=targetIsDirectMedia()?'replace':(/placeholder|photo|image|media|frame|polaroid/.test(signature)?'replace':'inside');
        mediaPanel.querySelector('#mediaTargetMeta').textContent=targetIsDirectMedia()?'This is a media element. Choosing media replaces its source.':'This section supports media. Choose an existing file or upload a new one.';
        renderAttached();
      }else attached.innerHTML='';
    }

    async function applyMedia(rec){
      if(!selected?.selector)throw new Error('Select a media-enabled section first.');
      if(!rec?.url)throw new Error('Choose a media file first.');
      const patch=patchFor(selected.selector);
      if(targetIsDirectMedia()){
        patch.src=rec.url;
      }else{
        patch.insertImages??=[];
        patch.insertImages.push({id:'media-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),url:rec.url,type:rec.type||'',name:rec.name||'',alt:'',placement:placement.value||'replace'});
      }
      dirty();mediaStatus.textContent='Publishing media…';await save();mediaStatus.textContent='Media added and published.';reloadPreview();renderAttached();
    }

    mediaPanel.querySelector('#useExistingMedia').onclick=async()=>{
      const index=Number(select.value);if(!Number.isInteger(index)||!mediaItems[index]){mediaStatus.textContent='Choose a file from Select media first.';return}
      try{await applyMedia(mediaItems[index])}catch(e){mediaStatus.textContent=e?.message||String(e)}
    };
    mediaPanel.querySelector('#addMediaToSelection').onchange=async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{mediaStatus.textContent='Uploading '+file.name+'…';const rec=await uploadShared(file);mediaItems.unshift(rec);await refreshMediaPicker();select.value='0';await applyMedia(rec);await renderSharedMedia()}catch(err){mediaStatus.textContent=err?.message||String(err)}finally{e.target.value=''}
    };
    mediaPanel.querySelector('#refreshMediaPicker').onclick=()=>refreshMediaPicker();

    const hideStatus=hidePanel.querySelector('#hideToolsStatus'),hiddenList=hidePanel.querySelector('#hiddenElementsList');
    function hiddenPatches(){return (state?.patches?.[pageName()]||[]).filter(p=>p&&p.hidden)}
    function renderHidden(){
      const items=hiddenPatches();hiddenList.innerHTML='';if(!items.length){hiddenList.innerHTML='<div class="hidden-empty">Nothing hidden on this page.</div>';return}
      items.forEach(p=>{const row=document.createElement('div');row.className='hidden-item';const code=document.createElement('code');code.textContent=p.selector||'(unknown selector)';const restore=document.createElement('button');restore.type='button';restore.className='btn';restore.textContent='Restore';restore.onclick=async()=>{p.hidden=false;dirty();hideStatus.textContent='Restoring…';try{await save();hideStatus.textContent='Restored on the live page.';renderHidden();reloadPreview()}catch(e){hideStatus.textContent=e?.message||String(e)}};row.append(code,restore);hiddenList.appendChild(row)})
    }
    hidePanel.querySelector('#hideSelectedElement').onclick=async()=>{if(!selected?.selector){hideStatus.textContent='Select something in the preview first.';return}const patch=patchFor(selected.selector);patch.hidden=true;dirty();hideStatus.textContent='Hiding selected element…';try{await save();hideStatus.textContent='Hidden on the live page.';renderHidden();reloadPreview()}catch(e){hideStatus.textContent=e?.message||String(e)}};
    hidePanel.querySelector('#refreshHiddenList').onclick=renderHidden;

    const originalSelect=typeof selectElement==='function'?selectElement:null;
    if(originalSelect){selectElement=function(el){originalSelect(el);setTimeout(()=>{updateMediaPanel();renderHidden()},0)}}
    document.getElementById('previewPage')?.addEventListener('change',()=>setTimeout(()=>{updateMediaPanel();renderHidden()},0));
    document.getElementById('reloadPreview')?.addEventListener('click',()=>setTimeout(updateMediaPanel,250));
    setInterval(()=>{const sig=(selected?.selector||'')+'|'+(selected?.tag||'');if(sig!==selectedSignature){selectedSignature=sig;updateMediaPanel()}},300);
    renderHidden();refreshMediaPicker();
  }


  // Visual-editor polish: use the original hide switch, real color pickers, and visual media tiles.
  const polishStyle=document.createElement('style');
  polishStyle.textContent='.ve-media-picker{display:none;margin:10px 0 0;padding:10px;border:1px solid var(--line);border-radius:12px;background:#0d0f13}.ve-media-picker.open{display:block}.ve-media-search{width:100%;box-sizing:border-box;border:1px solid var(--line);background:#101217;color:#fff;padding:9px 10px;border-radius:9px;margin-bottom:8px}.ve-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:300px;overflow:auto}.ve-media-tile{border:1px solid var(--line);background:#101217;border-radius:10px;padding:5px;cursor:pointer;color:#fff;text-align:left;min-width:0}.ve-media-tile.active{border-color:#f5f5f4;box-shadow:0 0 0 1px #f5f5f4 inset}.ve-thumb{aspect-ratio:1/1;border-radius:7px;overflow:hidden;background:#171a20;display:grid;place-items:center}.ve-thumb img,.ve-thumb video{width:100%;height:100%;object-fit:cover;display:block}.ve-name{display:block;margin-top:5px;font-size:9px;color:#aeb3bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ve-media-empty{grid-column:1/-1;text-align:center;color:#747a84;padding:18px 6px;font-size:10px}.ve-place{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.ve-place button{border:1px solid var(--line);background:#101217;color:#aeb3bd;border-radius:999px;padding:7px 9px;font-size:9px;cursor:pointer}.ve-place button.active{background:#f5f5f4;color:#111;border-color:#f5f5f4}.ve-picker-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.ve-color-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:7px;align-items:center}.ve-color-row input[type=color]{width:44px;height:42px;padding:3px;border:1px solid var(--line);border-radius:9px;background:#101217;cursor:pointer}.ve-hide-note{margin-top:5px;font-size:9px;color:#8e949f}.bday-raw-media-field{display:none!important}@media(max-width:650px){.ve-media-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-height:260px}}';
  document.head.appendChild(polishStyle);

  const vePanel=document.getElementById('mediaTargetTools');
  let vePicker,veGrid,veSearch,veUse,vePicked=-1,vePlacement='replace';
  if(vePanel){
    const oldSelect=vePanel.querySelector('#existingMediaSelect');
    const oldUse=vePanel.querySelector('#useExistingMedia');
    const oldPlace=vePanel.querySelector('#mediaPlacement');
    if(oldSelect)oldSelect.closest('.media-target-row')?.remove();
    if(oldPlace)oldPlace.closest('.media-target-placement')?.remove();
    if(oldUse)oldUse.remove();

    const visual=document.createElement('div');
    visual.innerHTML='<div class="ve-picker-actions"><button class="btn" type="button" id="veChooseMedia">Choose media</button></div><div class="ve-media-picker" id="veMediaPicker"><input class="ve-media-search" id="veMediaSearch" type="search" placeholder="Search media"><div class="ve-media-grid" id="veMediaGrid"></div><div class="ve-place" id="vePlace"><button type="button" data-p="replace" class="active">Replace</button><button type="button" data-p="inside">Inside</button><button type="button" data-p="before">Before</button><button type="button" data-p="after">After</button></div><button class="btn primary" type="button" id="veUseMedia">Use selected media</button></div>';
    const actions=vePanel.querySelector('.media-target-actions');
    actions?.before(visual);
    vePicker=visual.querySelector('#veMediaPicker');veGrid=visual.querySelector('#veMediaGrid');veSearch=visual.querySelector('#veMediaSearch');veUse=visual.querySelector('#veUseMedia');
    const place=visual.querySelector('#vePlace');

    function veKind(rec){
      const t=String(rec?.type||'').toLowerCase(),u=String(rec?.url||'').toLowerCase().split('?')[0];
      if(t.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/.test(u))return 'video';
      if(t.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(u))return 'audio';
      return 'image';
    }
    function veLabel(rec){return rec?.name||rec?.path?.split('/').pop()||'media'}
    function veRender(){
      if(!veGrid)return;
      const q=(veSearch?.value||'').trim().toLowerCase();veGrid.innerHTML='';
      const list=mediaItems.map((rec,index)=>({rec,index})).filter(x=>!q||veLabel(x.rec).toLowerCase().includes(q));
      if(!list.length){veGrid.innerHTML='<div class="ve-media-empty">No matching media.</div>';return}
      list.forEach(({rec,index})=>{
        const b=document.createElement('button');b.type='button';b.className='ve-media-tile'+(index===vePicked?' active':'');
        const k=veKind(rec),v=k==='image'?'<img src="'+rec.url+'" alt="">':k==='video'?'<video src="'+rec.url+'" muted playsinline preload="metadata"></video>':'<span style="font-size:26px;opacity:.75">♫</span>';
        b.innerHTML='<span class="ve-thumb">'+v+'</span><span class="ve-name"></span>';b.querySelector('.ve-name').textContent=veLabel(rec);
        b.onclick=()=>{vePicked=index;veRender();mediaStatus.textContent='Selected: '+veLabel(rec)};veGrid.appendChild(b);
      });
    }
    async function veLoad(force=false){
      try{if(force||!mediaItems.length)await sharedMedia();if(vePicked>=mediaItems.length)vePicked=-1;veRender()}
      catch(e){veGrid.innerHTML='<div class="ve-media-empty">'+String(e?.message||e).replace(/[<>]/g,'')+'</div>'}
    }
    visual.querySelector('#veChooseMedia').onclick=async()=>{vePicker.classList.toggle('open');if(vePicker.classList.contains('open'))await veLoad()};
    veSearch.oninput=veRender;
    place.onclick=e=>{const b=e.target.closest('button[data-p]');if(!b)return;vePlacement=b.dataset.p;place.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));if(oldPlace)oldPlace.value=vePlacement};
    function insertedMediaOwner(){
      const el=previewElement(),token=el?.dataset?.bdayInserted||'';
      if(!token)return null;
      const patches=state?.patches?.[pageName()]||[];
      for(const p of patches){
        const list=Array.isArray(p?.insertImages)?p.insertImages:[];
        const index=list.findIndex(item=>(item?.id||item?.url)===token);
        if(index>=0)return {patch:p,index,item:list[index]};
      }
      return null;
    }
    function previewMediaNode(rec,id){
      const type=String(rec?.type||'').toLowerCase(),url=String(rec?.url||'');
      let el;
      if(type.startsWith('video/')){el=document.createElement('video');el.controls=true;el.playsInline=true;el.preload='metadata'}
      else if(type.startsWith('audio/')){el=document.createElement('audio');el.controls=true;el.preload='metadata'}
      else{el=document.createElement('img');el.alt=rec?.name||'';el.loading='lazy'}
      el.src=url;el.className='bday-added-media';el.dataset.bdayInserted=id||url;
      return el;
    }
    function showMediaImmediately(rec,itemId){
      const el=previewElement();if(!el)return;
      const owner=insertedMediaOwner();
      if(owner&&el.matches?.('img,video,audio,source')){
        el.setAttribute('src',rec.url);if('src' in el)el.src=rec.url;el.dataset.bdayInserted=owner.item?.id||itemId||rec.url;el.load?.();return;
      }
      if(targetIsDirectMedia()){
        el.setAttribute('src',rec.url);if('src' in el)el.src=rec.url;el.load?.();return;
      }
      const node=previewMediaNode(rec,itemId);
      if(vePlacement==='replace'){
        const existing=el.querySelector?.('[data-bday-inserted],.bday-added-media,.bday-added-photo');
        if(existing){existing.replaceWith(node)}
        else{el.innerHTML='';el.appendChild(node)}
      }else if(vePlacement==='inside')el.appendChild(node);
      else if(vePlacement==='before')el.parentNode?.insertBefore(node,el);
      else el.parentNode?.insertBefore(node,el.nextSibling);
    }
    async function veApplySelected(rec){
      if(!selected?.selector)throw new Error('Select a media-enabled section first.');
      if(!rec?.url)throw new Error('Pick a media file first.');
      pushHistory();
      const owner=insertedMediaOwner();
      let itemId='';
      if(owner){
        owner.patch.insertImages[owner.index]={...owner.item,url:rec.url,type:rec.type||'',name:veLabel(rec)};
        itemId=owner.patch.insertImages[owner.index].id||owner.patch.insertImages[owner.index].url;
      }else{
        const p=patchFor(selected.selector);
        if(targetIsDirectMedia()){
          p.src=rec.url;
          itemId=rec.url;
        }else{
          p.insertImages??=[];
          const item={id:'media-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),url:rec.url,type:rec.type||'',name:veLabel(rec),alt:'',placement:vePlacement||'replace'};
          if(item.placement==='replace')p.insertImages=[item];
          else p.insertImages.push(item);
          itemId=item.id;
        }
      }
      dirty();
      showMediaImmediately(rec,itemId);
      mediaStatus.textContent='Saving…';
      await save();
      mediaStatus.textContent='Media updated.';
      updateHistoryButtons();
    }
    veUse.onclick=async()=>{
      if(vePicked<0||!mediaItems[vePicked]){mediaStatus.textContent='Pick a thumbnail first.';return}
      try{await veApplySelected(mediaItems[vePicked])}
      catch(e){mediaStatus.textContent=e?.message||String(e)}
    };
    const veAddInput=vePanel.querySelector('#addMediaToSelection');
    if(veAddInput)veAddInput.onchange=async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        mediaStatus.textContent='Uploading '+file.name+'…';
        const rec=await uploadShared(file);
        mediaItems.unshift(rec);vePicked=0;veRender();
        await veApplySelected(rec);
        await renderSharedMedia();
      }catch(err){mediaStatus.textContent=err?.message||String(err)}
      finally{e.target.value=''}
    };
    window.veRefreshMedia=veLoad;
  }

  function veHex(value){
    const v=String(value||'').trim();let m=v.match(/^#([0-9a-f]{6})$/i);if(m)return '#'+m[1].toLowerCase();
    m=v.match(/^#([0-9a-f]{3})$/i);if(m)return '#'+m[1].split('').map(c=>c+c).join('').toLowerCase();
    m=v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if(m)return '#'+[m[1],m[2],m[3]].map(n=>Math.max(0,Math.min(255,Math.round(Number(n)))).toString(16).padStart(2,'0')).join('');
    return '#000000';
  }
  function veColor(id,prop){
    const input=document.getElementById(id);if(!input||input.dataset.veColor)return;input.dataset.veColor='1';
    const row=document.createElement('div');row.className='ve-color-row';input.before(row);row.appendChild(input);
    const picker=document.createElement('input');picker.type='color';picker.value=veHex(input.value);picker.setAttribute('aria-label',prop==='color'?'Text color':'Background color');row.appendChild(picker);
    let gestureStarted=false;
    const preview=()=>{if(!selected?.selector)return;const p=patchFor(selected.selector);p.styles[prop]=input.value;previewElement()?.style.setProperty(prop,input.value);dirty()};
    picker.oninput=()=>{if(!gestureStarted){pushHistory();gestureStarted=true}input.value=picker.value;preview()};
    picker.onchange=async()=>{preview();gestureStarted=false;try{await save();toast?.('Color updated');updateHistoryButtons()}catch(e){}};
    input.addEventListener('change',async()=>{pushHistory();picker.value=veHex(input.value);preview();try{await save();updateHistoryButtons()}catch(e){}});
  }
  function veHide(){
    const h=document.getElementById('iHidden');if(!h||h.dataset.veHide)return;h.dataset.veHide='1';
    const row=h.closest('.toggle');if(row&&!row.querySelector('.ve-hide-note')){const n=document.createElement('div');n.className='ve-hide-note';n.textContent='Hidden items stay outlined in this editor so you can turn them back on.';row.appendChild(n)}
    h.addEventListener('change',async()=>{if(!selected?.selector)return;pushHistory();const p=patchFor(selected.selector);p.hidden=h.checked;dirty();const el=previewElement();if(el){el.style.removeProperty('display');if(h.checked){el.style.outline='2px dashed #ff7f7f';el.style.outlineOffset='2px'}else{el.style.removeProperty('outline');el.style.removeProperty('outline-offset')}}try{await save();toast?.(h.checked?'Element hidden':'Element visible');updateHistoryButtons()}catch(e){}});
  }
  function veDecorate(){
    document.querySelectorAll('#hideTools,.hide-tools,.attached-media-list,.hidden-list').forEach(el=>el.remove());
    veColor('iColor','color');veColor('iBg','background-color');veHide();
    if(isMediaTarget()){
      const src=document.getElementById('iSrc');if(src)src.closest('.field')?.classList.add('bday-raw-media-field');
      const fp=document.getElementById('iFilePick');if(fp)fp.closest('.field')?.classList.add('bday-raw-media-field');
      if(vePanel){const direct=targetIsDirectMedia();const el=previewElement();const sig=((el?.id||'')+' '+(typeof el?.className==='string'?el.className:'')).toLowerCase();vePlacement=direct?'replace':(/placeholder|photo|image|media|frame|polaroid/.test(sig)?'replace':'inside');vePanel.querySelector('#vePlace')?.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.p===vePlacement));const old=document.getElementById('mediaPlacement');if(old)old.value=vePlacement}
    }
  }
  new MutationObserver(()=>queueMicrotask(veDecorate)).observe(document.getElementById('inspectorFields'),{subtree:true,childList:true});
  setInterval(veDecorate,350);


  function mountHistoryToolbar(){
    if(document.getElementById('veHistory'))return;
    const bar=document.querySelector('.previewbar');if(!bar)return;
    const group=document.createElement('div');group.id='veHistory';group.style.cssText='display:flex;gap:6px;align-items:center';
    group.innerHTML='<button class="btn" type="button" id="veUndo" title="Undo (Ctrl/Cmd+Z)">↶ Undo</button><button class="btn" type="button" id="veRedo" title="Redo (Ctrl/Cmd+Shift+Z)">↷ Redo</button>';
    const spacer=bar.querySelector('.spacer');bar.insertBefore(group,spacer||null);
    group.querySelector('#veUndo').onclick=undoEditor;
    group.querySelector('#veRedo').onclick=redoEditor;
    updateHistoryButtons();
  }
  function bindInstantInspector(){
    const el=previewElement();if(!el)return;
    const live=[
      ['iText',(target,value)=>{target.textContent=value}],
      ['iSize',(target,value)=>target.style.setProperty('font-size',value)],
      ['iOpacity',(target,value)=>target.style.setProperty('opacity',value)],
      ['iRadius',(target,value)=>target.style.setProperty('border-radius',value)],
      ['iTransform',(target,value)=>target.style.setProperty('transform',value)],
      ['iHref',(target,value)=>{if(target.matches?.('a'))target.setAttribute('href',value)}]
    ];
    live.forEach(([id,apply])=>{
      const input=document.getElementById(id);if(!input||input.dataset.veLive)return;input.dataset.veLive='1';
      input.addEventListener('input',()=>{const target=previewElement();if(target)apply(target,input.value)});
    });
    const apply=document.getElementById('applyPatch');
    if(apply&&!apply.dataset.veHistory){
      apply.dataset.veHistory='1';const original=apply.onclick;
      apply.onclick=function(e){pushHistory();const out=original?.call(this,e);updateHistoryButtons();return out};
    }
    const remove=document.getElementById('removePatch');
    if(remove&&!remove.dataset.veHistory){
      remove.dataset.veHistory='1';const original=remove.onclick;
      remove.onclick=function(e){pushHistory();const out=original?.call(this,e);updateHistoryButtons();return out};
    }
  }
  mountHistoryToolbar();
  document.addEventListener('keydown',e=>{
    const mod=e.ctrlKey||e.metaKey;if(!mod)return;
    const tag=document.activeElement?.tagName?.toLowerCase();
    if(['input','textarea','select'].includes(tag))return;
    if(e.key.toLowerCase()==='z'){
      e.preventDefault();
      if(e.shiftKey)redoEditor();else undoEditor();
    }else if(e.key.toLowerCase()==='y'){e.preventDefault();redoEditor()}
  });
  setInterval(()=>{mountHistoryToolbar();bindInstantInspector()},250);

  function installEnhancedFramePicking(){
    const frame=document.getElementById('previewFrame');if(!frame)return;
    function attach(){
      let d,w;try{d=frame.contentDocument;w=frame.contentWindow}catch(e){return}
      if(!d||!w||w.__bdayEnhancedPicking)return;w.__bdayEnhancedPicking=true;
      const s=d.createElement('style');
      s.textContent='.scribble,.handwritten,.note,[id*="scribble"],[class*="scribble"],[class*="handwritten"]{pointer-events:auto!important}';
      d.head?.appendChild(s);

      const selector='a,button,img,video,audio,source,h1,h2,h3,h4,h5,h6,p,span,div,small,strong,em,li,section,article';
      const directText=el=>[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      const depth=el=>{let n=el,k=0;while(n&&n!==d.body){k++;n=n.parentElement}return k};

      w.addEventListener('click',e=>{
        if(window.__previewInteractMode)return;
        const x=e.clientX,y=e.clientY;
        let target=e.target?.closest?.(selector)||null;
        const candidates=[];
        for(const el of d.querySelectorAll(selector)){
          const r=el.getBoundingClientRect();
          if(r.width<=0||r.height<=0||x<r.left||x>r.right||y<r.top||y>r.bottom)continue;
          const cls=(typeof el.className==='string'?el.className:'').toLowerCase();
          const special=/scribble|handwritten|caption|note/.test(cls)||/scribble/i.test(el.id||'');
          const text=directText(el);
          if(!special&&!text)continue;
          const area=Math.max(1,r.width*r.height);
          const score=(special?1000000:0)+(text?100000:0)+(el.id?10000:0)+(depth(el)*100)-(area/1000);
          candidates.push({el,score});
        }
        if(candidates.length){
          candidates.sort((a,b)=>b.score-a.score);
          target=candidates[0].el;
        }
        if(!target)return;
        e.preventDefault();e.stopImmediatePropagation();
        try{selectElement(target)}catch(err){}
      },true);
    }
    frame.addEventListener('load',()=>setTimeout(attach,30));
    setTimeout(attach,120);
  }
  installEnhancedFramePicking();

  renderSharedMedia();
})();
