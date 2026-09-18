(()=>{
  const MEDIA_ENDPOINT='https://aaimjubffhdujevrdamo.supabase.co/functions/v1/birthday-site-media';
  const TRANSIENT=/\.(?:visible|active|open|shown|show|entered|in-view|is-visible|revealed)\b/g;
  const GENERATED=/(bday-added-media|bday-added-photo|data-bday-inserted|data-bday-group)/i;
  const EDITABLE_SELECTOR='a,button,img,video,audio,source,h1,h2,h3,h4,h5,h6,p,span,div,small,strong,em,li,section,article,svg,text,tspan';
  let mediaItems=[],picked=-1,placement='replace',historyBusy=false,undoStack=[],redoStack=[];
  const HISTORY_LIMIT=40;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const attr=s=>esc(s).replace(/"/g,'&quot;');
  function adminKey(){return sessionStorage.getItem('birthday-admin-key')||''}
  function pageName(){return document.getElementById('previewPage')?.value||'index.html'}
  function stableSelector(s){return String(s||'').replace(TRANSIENT,'').trim()}
  function pagePatches(page=pageName()){state.patches??={};state.patches[page]??=[];return state.patches[page]}
  function findPatch(selector){const s=stableSelector(selector);return pagePatches().find(p=>stableSelector(p?.selector)===s)||null}
  function patchFor(selector){const s=stableSelector(selector);let p=findPatch(s);if(!p){p={selector:s,styles:{}};pagePatches().push(p)}else p.selector=s;p.styles??={};return p}
  function patchMeaningful(p){
    if(!p)return false;
    if(p.text!==undefined||p.src!==undefined||p.href!==undefined||p.hidden!==undefined)return true;
    if(p.styles&&Object.keys(p.styles).some(k=>p.styles[k]!==''&&p.styles[k]!=null))return true;
    if(Array.isArray(p.insertImages)&&p.insertImages.length)return true;
    if(Array.isArray(p.insertMedia)&&p.insertMedia.length)return true;
    return false;
  }
  function prunePatch(p){
    if(!p)return;
    if(p.styles&&!Object.keys(p.styles).length)delete p.styles;
    if(Array.isArray(p.insertImages)&&!p.insertImages.length)delete p.insertImages;
    if(Array.isArray(p.insertMedia)&&!p.insertMedia.length)delete p.insertMedia;
    if(!patchMeaningful(p)){const list=pagePatches();const i=list.indexOf(p);if(i>=0)list.splice(i,1)}
  }
  function currentDoc(){try{return document.getElementById('previewFrame')?.contentDocument||null}catch(e){return null}}
  function currentWin(){try{return document.getElementById('previewFrame')?.contentWindow||null}catch(e){return null}}
  function cleanClasses(el){return [...(el.classList||[])].filter(c=>!['visible','active','open','shown','show','entered','in-view','is-visible','revealed'].includes(c)&&!/^bday-/.test(c)).sort().slice(0,3)}
  function sourceSiblings(el){if(!el.parentElement)return [el];return [...el.parentElement.children].filter(n=>n.tagName===el.tagName&&!n.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]'))}
  function structuralKey(el){
    const bits=[];let n=el,guard=0;
    while(n&&n.nodeType===1&&n!==n.ownerDocument.body&&guard++<8){
      const tag=n.tagName.toLowerCase();if(n.id){bits.unshift(tag+'#'+n.id);break}
      const cls=cleanClasses(n),siblings=sourceSiblings(n),idx=Math.max(1,siblings.indexOf(n)+1);
      bits.unshift(tag+(cls.length?'.'+cls.join('.'):'')+':'+idx);n=n.parentElement;
    }return bits.join('>');
  }
  function hash32(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function ensureEditIds(doc=currentDoc()){
    if(!doc)return;
    const page=pageName()==='entry.html'?'index.html':pageName();
    for(const el of doc.querySelectorAll(EDITABLE_SELECTOR)){
      if(el.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]'))continue;
      if(!el.dataset.editId)el.dataset.editId='be-'+hash32(page+'|'+structuralKey(el));
    }
  }
  function generatedOwnerByToken(token){
    if(!token)return null;
    for(const p of pagePatches()){
      for(const listKey of ['insertImages','insertMedia']){
        const list=Array.isArray(p?.[listKey])?p[listKey]:[];
        const index=list.findIndex(item=>(item?.id||item?.url)===token);
        if(index>=0)return {patch:p,listKey,index,item:list[index]};
      }
    }return null;
  }
  function selectorFor(el){
    if(!el)return '';
    const token=el.dataset?.bdayInserted||'';
    if(token){const owner=generatedOwnerByToken(token);if(owner)return owner.patch.selector}
    const slot=el.getAttribute?.('data-media-slot');
    if(slot)return '[data-media-slot="'+CSS.escape(slot)+'"]';
    if(el.id)return '#'+CSS.escape(el.id);
    ensureEditIds(el.ownerDocument);
    if(el.dataset?.editId)return '[data-edit-id="'+CSS.escape(el.dataset.editId)+'"]';
    return '';
  }
  function lookupAll(selector){
    const doc=currentDoc();if(!doc||!selector)return [];
    for(const s of [...new Set([selector,stableSelector(selector)].filter(Boolean))]){try{const nodes=[...doc.querySelectorAll(s)];if(nodes.length)return nodes}catch(e){}}
    return [];
  }
  function lookup(selector){return lookupAll(selector)[0]||null}
  function previewElement(){return selected?.element?.isConnected?selected.element:(selected?.selector?lookup(selected.selector):null)}
  function isBroad(el){return !!el&&['HTML','BODY','MAIN','SECTION','ARTICLE'].includes(el.tagName)}
  function textEditable(el){
    if(!el||isBroad(el)||el.matches?.('.bday-added-media,.bday-added-photo,[data-bday-inserted]'))return false;
    if(['IMG','VIDEO','AUDIO','SOURCE','INPUT','TEXTAREA','SELECT','PICTURE','SVG'].includes(el.tagName))return false;
    if(['TEXT','TSPAN'].includes(el.tagName))return true;
    const children=[...el.children].filter(x=>x.tagName!=='BR');
    if(children.length)return false;
    return ['H1','H2','H3','H4','H5','H6','P','SPAN','DIV','SMALL','STRONG','EM','LI','A','BUTTON'].includes(el.tagName)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  }
  function mediaSlot(el){
    if(!el||isBroad(el)||el.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]'))return false;
    if(el.hasAttribute?.('data-media-slot'))return true;
    if(['IMG','VIDEO','AUDIO','SOURCE','PICTURE'].includes(el.tagName))return true;
    const signature=((el.id||'')+' '+(typeof el.className==='string'?el.className:'')).toLowerCase();
    return /(^|[\s_-])(photo|image|media|polaroid|poster|picture|pic|frame|shot|avatar|placeholder|thumb)([\s_-]|$)/.test(signature);
  }
  function directMedia(el=previewElement()){return !!el&&['IMG','VIDEO','AUDIO','SOURCE'].includes(el.tagName)}
  function editSnapshot(){return {page:pageName(),selector:selected?.selector||'',patches:clone(pagePatches())}}
  function updateHistoryButtons(){const u=document.getElementById('veUndo'),r=document.getElementById('veRedo');if(u)u.disabled=!undoStack.length||historyBusy;if(r)r.disabled=!redoStack.length||historyBusy}
  function pushHistory(){if(historyBusy)return;undoStack.push(editSnapshot());if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack=[];updateHistoryButtons()}
  async function publishNoReload(){const result=await save({reload:false});if(!result)throw new Error('Publish did not complete.');return result}
  async function restoreHistory(entry,targetStack){
    if(!entry||historyBusy)return;historyBusy=true;updateHistoryButtons();
    const current=editSnapshot();targetStack.push(current);if(targetStack.length>HISTORY_LIMIT)targetStack.shift();
    try{
      state.patches[entry.page]=clone(entry.patches);dirty();
      const select=document.getElementById('previewPage');if(select&&[...select.options].some(o=>o.value===entry.page))select.value=entry.page;
      await publishNoReload();reloadPreview();
      setTimeout(()=>{try{const el=lookup(entry.selector);if(el)window.selectElement(el)}catch(e){}},450);
    }finally{historyBusy=false;updateHistoryButtons()}
  }
  async function undo(){if(!undoStack.length)return;const entry=undoStack.pop();await restoreHistory(entry,redoStack)}
  async function redo(){if(!redoStack.length)return;const entry=redoStack.pop();await restoreHistory(entry,undoStack)}

  async function sharedMedia(){
    const key=adminKey();if(!key)throw new Error('Unlock the Control Room first.');
    const r=await fetch(MEDIA_ENDPOINT+'?folder=birthday-site',{headers:{'x-admin-key':key},cache:'no-store'});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not load shared media');
    mediaItems=Array.isArray(j.items)?j.items:[];return mediaItems;
  }
  async function uploadShared(file){
    const key=adminKey();if(!key)throw new Error('Unlock the Control Room first.');
    const fd=new FormData();fd.append('file',file);fd.append('folder','birthday-site');
    const r=await fetch(MEDIA_ENDPOINT,{method:'POST',headers:{'x-admin-key':key},body:fd});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Upload failed');
    return {name:j.name||file.name,type:j.type||file.type,size:j.size||file.size,url:j.url,path:j.path||''};
  }
  function kind(rec){const t=String(rec?.type||'').toLowerCase(),u=String(rec?.url||'').toLowerCase().split('?')[0];if(t.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/.test(u))return 'video';if(t.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(u))return 'audio';return 'image'}
  function label(rec){return rec?.name||rec?.path?.split('/').pop()||'media'}
  function mediaNode(rec,id){
    const k=kind(rec);let el;if(k==='video'){el=document.createElement('video');el.controls=true;el.playsInline=true;el.preload='metadata'}else if(k==='audio'){el=document.createElement('audio');el.controls=true;el.preload='metadata'}else{el=document.createElement('img');el.alt=label(rec);el.loading='lazy'}
    el.src=rec.url;el.className='bday-added-media';el.dataset.bdayInserted=id||rec.url;return el;
  }
  function prepareSlot(el){
    if(!el||isBroad(el))return false;
    if(el.dataset.bdayMediaReplaced==='1')return true;
    const holder=el.ownerDocument.createElement('span');holder.className='bday-original-slot-content';holder.dataset.bdayOriginalSlot='1';
    while(el.firstChild)holder.appendChild(el.firstChild);holder.hidden=true;el.appendChild(holder);el.dataset.bdayMediaReplaced='1';return true;
  }
  function restoreSlot(el){
    if(!el||el.dataset.bdayMediaReplaced!=='1')return;
    const holder=[...el.children].find(x=>x.dataset?.bdayOriginalSlot==='1');
    el.querySelectorAll(':scope > .bday-added-media').forEach(n=>n.remove());
    if(holder){while(holder.firstChild)el.insertBefore(holder.firstChild,holder);holder.remove()}
    delete el.dataset.bdayMediaReplaced;
  }
  function ownerForSelection(){
    const token=selected?.mediaToken||previewElement()?.dataset?.bdayInserted||'';
    if(token){const owner=generatedOwnerByToken(token);if(owner)return owner}
    const p=findPatch(selected?.selector||'');
    if(!p)return null;
    for(const listKey of ['insertImages','insertMedia']){
      const list=Array.isArray(p[listKey])?p[listKey]:[];
      if(list.length===1)return {patch:p,listKey,index:0,item:list[0]};
      const replaceIndex=list.findIndex(x=>(x?.placement||'inside')==='replace');
      if(replaceIndex>=0)return {patch:p,listKey,index:replaceIndex,item:list[replaceIndex]};
    }
    return null;
  }
  function showMedia(rec,itemId,itemPlacement){
    const primary=previewElement();if(!primary)return;
    const mirrors=primary.hasAttribute?.('data-media-slot')?lookupAll(selected.selector):[primary];
    for(const el of mirrors){
      const doc=el.ownerDocument;
      if(directMedia(el)){
        if(!el.dataset.bdayOriginalSrc)el.dataset.bdayOriginalSrc=el.getAttribute('src')||'';
        el.setAttribute('src',rec.url);if('src' in el)el.src=rec.url;el.load?.();continue;
      }
      if(!mediaSlot(el))continue;
      const node=mediaNode(rec,itemId),p=itemPlacement||placement;
      if(p==='replace'){prepareSlot(el);el.querySelectorAll(':scope > .bday-added-media').forEach(n=>n.remove());el.appendChild(node)}
      else if(p==='inside')el.appendChild(node);
      else{
        const group=doc.createElement('div');group.className='bday-added-media-group';group.dataset.bdayGroup='editor-preview-'+itemId;group.appendChild(node);
        if(p==='before')el.parentNode?.insertBefore(group,el);else el.parentNode?.insertBefore(group,el.nextSibling);
      }
    }
  }
  function removeMediaPreview(owner){
    const primary=previewElement();if(!primary)return;
    const mirrors=primary.hasAttribute?.('data-media-slot')?lookupAll(selected.selector):[primary];
    if(owner?.item){
      const token=CSS.escape(String(owner.item.id||owner.item.url||''));
      const nodes=[...(currentDoc()?.querySelectorAll('[data-bday-inserted="'+token+'"]')||[])];
      for(const node of nodes){const group=node.closest?.('.bday-added-media-group')||null;node.remove();if(group&&!group.children.length)group.remove()}
      if((owner.item.placement||'inside')==='replace')mirrors.forEach(restoreSlot);
    }else{
      for(const el of mirrors){
        if(!directMedia(el))continue;
        const original=el.dataset.bdayOriginalSrc;
        if(original!==undefined){el.setAttribute('src',original);if('src' in el)el.src=original;delete el.dataset.bdayOriginalSrc;el.load?.()}
      }
    }
  }

  const style=document.createElement('style');
  style.textContent='.ve-media-tools{display:none;margin:12px 0;padding:12px;border:1px solid var(--line);background:#111318;border-radius:12px}.ve-media-tools.show{display:block}.ve-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:300px;overflow:auto;margin-top:8px}.ve-media-tile{border:1px solid var(--line);background:#101217;border-radius:10px;padding:5px;cursor:pointer;color:#fff;text-align:left;min-width:0}.ve-media-tile.active{border-color:#fff}.ve-thumb{aspect-ratio:1;border-radius:7px;overflow:hidden;background:#171a20;display:grid;place-items:center}.ve-thumb img,.ve-thumb video{width:100%;height:100%;object-fit:cover}.ve-name{display:block;margin-top:5px;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ve-place{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.ve-place button{border:1px solid var(--line);background:#101217;color:#aaa;border-radius:999px;padding:6px 9px;font-size:9px}.ve-place button.active{background:#fff;color:#111}.ve-actions{display:flex;gap:8px;flex-wrap:wrap}.ve-status{min-height:16px;margin-top:8px;font-size:10px;color:#aeb3bd}.ve-color-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:7px}.ve-color-row input[type=color]{width:44px;height:42px;padding:3px;border:1px solid var(--line);border-radius:9px;background:#101217}.ve-note{font-size:10px;color:#858b96;margin:5px 0 10px}.bday-original-slot-content[hidden]{display:none!important}@media(max-width:650px){.ve-media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(style);

  const fields=document.getElementById('inspectorFields');
  let mediaPanel=null,grid=null,search=null,status=null,removeMediaBtn=null;
  if(fields){
    mediaPanel=document.createElement('div');mediaPanel.className='ve-media-tools';mediaPanel.id='veMediaTools';
    mediaPanel.innerHTML='<b style="font-size:10px;text-transform:uppercase;letter-spacing:.1em">Media</b><div class="ve-note" id="veMediaNote">Select a media slot.</div><div class="ve-actions"><button class="btn" type="button" id="veChoose">Choose media</button><label class="btn">+ Upload<input id="veUpload" type="file" accept="image/*,video/*,audio/*" style="display:none"></label><button class="btn danger" type="button" id="veRemoveMedia">Remove media</button></div><div id="vePicker" style="display:none"><input id="veSearch" type="search" placeholder="Search media" style="width:100%;margin-top:8px"><div class="ve-media-grid" id="veGrid"></div><div class="ve-place" id="vePlace"><button type="button" data-p="replace" class="active">Replace</button><button type="button" data-p="inside">Inside</button><button type="button" data-p="before">Before</button><button type="button" data-p="after">After</button></div><button class="btn primary" type="button" id="veUse">Use selected media</button></div><div class="ve-status" id="veStatus"></div>';
    fields.before(mediaPanel);grid=mediaPanel.querySelector('#veGrid');search=mediaPanel.querySelector('#veSearch');status=mediaPanel.querySelector('#veStatus');removeMediaBtn=mediaPanel.querySelector('#veRemoveMedia');
  }

  function renderMediaGrid(){
    if(!grid)return;const q=(search?.value||'').trim().toLowerCase();grid.innerHTML='';
    const list=mediaItems.map((rec,index)=>({rec,index})).filter(x=>!q||label(x.rec).toLowerCase().includes(q));
    if(!list.length){grid.innerHTML='<div class="ve-note">No matching media.</div>';return}
    list.forEach(({rec,index})=>{
      const b=document.createElement('button');b.type='button';b.className='ve-media-tile'+(index===picked?' active':'');
      const k=kind(rec);b.innerHTML='<span class="ve-thumb">'+(k==='image'?'<img src="'+attr(rec.url)+'" alt="">':k==='video'?'<video src="'+attr(rec.url)+'" muted playsinline></video>':'♫')+'</span><span class="ve-name">'+esc(label(rec))+'</span>';
      b.onclick=()=>{picked=index;renderMediaGrid();status.textContent='Selected: '+label(rec)};grid.appendChild(b);
    });
  }
  async function loadMedia(force=false){if(force||!mediaItems.length)await sharedMedia();if(picked>=mediaItems.length)picked=-1;renderMediaGrid()}
  function updateMediaPanel(){
    if(!mediaPanel)return;const el=previewElement(),capable=mediaSlot(el);mediaPanel.classList.toggle('show',capable);
    if(!capable)return;
    placement='replace';
    mediaPanel.querySelectorAll('#vePlace button').forEach(b=>{b.disabled=directMedia(el);b.classList.toggle('active',b.dataset.p===placement)});
    const slotName=el.getAttribute?.('data-media-label')||el.getAttribute?.('data-media-slot')||'';mediaPanel.querySelector('#veMediaNote').textContent=(slotName?slotName+' · ':'')+(directMedia(el)?'Replacing this media changes only its source.':'This is an explicit media slot. Replace is reversible and never deletes the slot DOM.');
    const p=findPatch(selected?.selector||''),owner=ownerForSelection();
    removeMediaBtn.disabled=!(owner||(directMedia(el)&&p?.src));
  }
  async function applySelected(rec){
    const el=previewElement();if(!el||!mediaSlot(el))throw new Error('Select an explicit media slot first.');
    if(!rec?.url)throw new Error('Pick media first.');
    pushHistory();
    const owner=ownerForSelection();let itemId='',itemPlacement=placement;
    if(owner){
      owner.patch[owner.listKey][owner.index]={...owner.item,url:rec.url,type:rec.type||'',name:label(rec)};
      const item=owner.patch[owner.listKey][owner.index];itemId=item.id||item.url;itemPlacement=item.placement||placement;
      selected.mediaToken=itemId;
    }else{
      const p=patchFor(selected.selector);
      if(directMedia(el)){p.src=rec.url;itemId=rec.url}
      else{
        p.insertImages??=[];
        const item={id:'media-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),url:rec.url,type:rec.type||'',name:label(rec),alt:'',placement:placement};
        if(placement==='replace')p.insertImages=[item];else p.insertImages.push(item);
        itemId=item.id;itemPlacement=item.placement;selected.mediaToken=itemId;
      }
    }
    dirty();showMedia(rec,itemId,itemPlacement);status.textContent='Publishing…';
    try{await publishNoReload();status.textContent='Media updated.';updateMediaPanel()}
    catch(e){status.textContent=e?.message||String(e);throw e}
  }
  async function removeSelectedMedia(){
    const el=previewElement();if(!el)return;
    const p=findPatch(selected?.selector||''),owner=ownerForSelection();
    if(!owner&&!(directMedia(el)&&p?.src)){status.textContent='No editor media is attached to this selection.';return}
    pushHistory();removeMediaPreview(owner);
    if(owner){owner.patch[owner.listKey].splice(owner.index,1);prunePatch(owner.patch);selected.mediaToken=''}
    else if(p?.src!==undefined){delete p.src;prunePatch(p)}
    dirty();status.textContent='Publishing removal…';
    try{await publishNoReload();status.textContent='Media removed.';updateMediaPanel()}
    catch(e){status.textContent=e?.message||String(e);throw e}
  }

  async function renderLibrary(){
    const box=document.getElementById('mediaGrid');if(!box)return;box.innerHTML='<div class="empty">Loading shared media…</div>';
    try{
      await sharedMedia();box.innerHTML='';
      for(const rec of mediaItems){
        const c=document.createElement('div');c.className='media-card';const k=kind(rec);
        c.innerHTML='<div class="media-thumb">'+(k==='image'?'<img src="'+attr(rec.url)+'" alt="">':k==='video'?'<video src="'+attr(rec.url)+'" muted></video>':'<audio controls src="'+attr(rec.url)+'"></audio>')+'</div><div class="media-meta"><b>'+esc(label(rec))+'</b><small>'+esc(rec.url||'')+'</small><div style="margin-top:8px"><button class="btn" data-copy type="button">Copy URL</button></div></div>';
        c.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(rec.url||'');toast('URL copied')}catch(e){}};box.appendChild(c);
      }
      if(!mediaItems.length)box.innerHTML='<div class="empty">No media uploaded yet.</div>';
    }catch(e){box.innerHTML='<div class="empty">Could not load media.</div>'}
  }
  window.renderMedia=renderLibrary;window.listMedia=sharedMedia;

  function fieldStyle(el,p){
    const s=el.ownerDocument.defaultView.getComputedStyle(el);return {
      color:p.styles?.color??s.color,bg:p.styles?.['background-color']??s.backgroundColor,
      size:p.styles?.['font-size']??s.fontSize,opacity:p.styles?.opacity??s.opacity,
      radius:p.styles?.['border-radius']??s.borderRadius,transform:p.styles?.transform??''
    };
  }
  function livePreview(){
    const el=previewElement();if(!el)return;
    const t=document.getElementById('iText');if(t&&textEditable(el))el.textContent=t.value;
    const href=document.getElementById('iHref');if(href&&el.matches('a'))el.setAttribute('href',href.value);
    const map=[['iColor','color'],['iBg','background-color'],['iSize','font-size'],['iOpacity','opacity'],['iRadius','border-radius'],['iTransform','transform']];
    for(const [id,prop] of map){const input=document.getElementById(id);if(input)el.style.setProperty(prop,input.value)}
  }
  async function applyInspector(){
    const el=previewElement();if(!el||!selected?.selector)return;
    pushHistory();const p=patchFor(selected.selector),t=document.getElementById('iText');
    if(t&&textEditable(el))p.text=t.value;else delete p.text;
    const hidden=document.getElementById('iHidden');if(hidden)p.hidden=hidden.checked;
    p.styles={color:document.getElementById('iColor')?.value||'','background-color':document.getElementById('iBg')?.value||'','font-size':document.getElementById('iSize')?.value||'',opacity:document.getElementById('iOpacity')?.value||'','border-radius':document.getElementById('iRadius')?.value||'',transform:document.getElementById('iTransform')?.value||''};
    const href=document.getElementById('iHref');if(href&&el.matches('a'))p.href=href.value;else delete p.href;
    dirty();livePreview();const result=await publishNoReload();if(result)toast('Element updated');
  }
  async function removeOverride(){
    if(!selected?.selector)return;pushHistory();const s=stableSelector(selected.selector);
    state.patches[pageName()]=pagePatches().filter(p=>stableSelector(p?.selector)!==s);dirty();
    await publishNoReload();reloadPreview();toast('Override removed');
  }
  function addColorPicker(id){
    const input=document.getElementById(id);if(!input)return;
    const row=document.createElement('div');row.className='ve-color-row';input.before(row);row.appendChild(input);
    const picker=document.createElement('input');picker.type='color';
    const v=String(input.value||'');const m=v.match(/^#([0-9a-f]{6})$/i);picker.value=m?'#'+m[1]:'#000000';row.appendChild(picker);
    picker.oninput=()=>{input.value=picker.value;livePreview()};
  }
  function renderInspector(el,selector,mediaToken=''){
    selected={selector,tag:el.tagName.toLowerCase(),mediaToken,element:el};
    document.getElementById('selectorBox').textContent=selector;
    const p=findPatch(selector)||{selector,styles:{}},style=fieldStyle(el,p),canText=textEditable(el),isLink=el.matches('a');
    fields.innerHTML=(canText?'<div class="field"><label>Text</label><textarea id="iText">'+esc(p.text??el.textContent.trim())+'</textarea></div>':'<div class="ve-note">Container text editing is disabled to protect child elements. Select the actual text element instead.</div>')+
      (isLink?'<div class="field"><label>Link href</label><input id="iHref" value="'+attr(p.href??el.getAttribute('href')??'')+'"></div>':'')+
      '<div class="toggle"><div><b>Hide element</b></div><label class="switch"><input id="iHidden" type="checkbox" '+(p.hidden?'checked':'')+'><i></i></label></div>'+
      '<div class="row"><div class="field"><label>Text color</label><input id="iColor" value="'+attr(style.color)+'"></div><div class="field"><label>Background</label><input id="iBg" value="'+attr(style.bg)+'"></div></div>'+
      '<div class="row"><div class="field"><label>Font size</label><input id="iSize" value="'+attr(style.size)+'"></div><div class="field"><label>Opacity</label><input id="iOpacity" value="'+attr(style.opacity)+'"></div></div>'+
      '<div class="row"><div class="field"><label>Border radius</label><input id="iRadius" value="'+attr(style.radius)+'"></div><div class="field"><label>Transform</label><input id="iTransform" value="'+attr(style.transform)+'"></div></div>'+
      '<div style="display:flex;gap:8px"><button class="btn primary" id="applyPatch" type="button">Apply</button><button class="btn danger" id="removePatch" type="button">Remove override</button></div>';
    document.getElementById('applyPatch').onclick=()=>applyInspector().catch(()=>{});
    document.getElementById('removePatch').onclick=()=>removeOverride().catch(()=>{});
    for(const id of ['iText','iHref','iColor','iBg','iSize','iOpacity','iRadius','iTransform'])document.getElementById(id)?.addEventListener('input',livePreview);
    document.getElementById('iHidden')?.addEventListener('change',async e=>{
      pushHistory();const patch=patchFor(selector);patch.hidden=e.target.checked;dirty();
      if(e.target.checked){el.style.outline='2px dashed #ff7f7f';el.style.outlineOffset='2px'}else{el.style.removeProperty('outline');el.style.removeProperty('outline-offset')}
      try{await publishNoReload();toast(e.target.checked?'Element hidden':'Element visible')}catch(err){}
    });
    addColorPicker('iColor');addColorPicker('iBg');
    updateMediaPanel();
  }
  window.cssSelector=selectorFor;
  window.currentPatch=selector=>findPatch(selector)||{selector,styles:{}};
  window.selectElement=function(clicked){
    if(!clicked)return;
    let token=clicked.dataset?.bdayInserted||'',el=clicked,selector='';
    if(token){
      const owner=generatedOwnerByToken(token);if(owner){selector=owner.patch.selector;el=lookup(selector)||clicked}
    }
    if(!selector)selector=selectorFor(el);
    if(!selector||GENERATED.test(selector))return;
    renderInspector(el,selector,token);
  };
  window.saveInspectorPatch=applyInspector;window.removeInspectorPatch=removeOverride;

  function attachFrame(){
    const frame=document.getElementById('previewFrame'),doc=currentDoc(),win=currentWin();if(!frame||!doc||!win)return;
    ensureEditIds(doc);if(win.__phase3EditorPicking)return;win.__phase3EditorPicking=true;
    const s=doc.createElement('style');s.textContent='.scribble,.handwritten,.note,[id*="scribble"],[class*="scribble"],[class*="handwritten"],svg text,svg tspan{pointer-events:auto!important}';doc.head?.appendChild(s);
    win.addEventListener('click',e=>{
      if(window.__previewInteractMode)return;
      const generated=e.target?.closest?.('.bday-added-media,[data-bday-inserted]');
      let target=generated||e.target?.closest?.(EDITABLE_SELECTOR);if(!target)return;
      const x=e.clientX,y=e.clientY,candidates=[];
      for(const el of doc.querySelectorAll(EDITABLE_SELECTOR)){
        if(el.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]'))continue;
        const r=el.getBoundingClientRect();if(!r.width||!r.height||x<r.left||x>r.right||y<r.top||y>r.bottom)continue;
        const cls=(typeof el.className==='string'?el.className:'').toLowerCase(),special=/scribble|handwritten|caption|note/.test(cls)||/scribble/i.test(el.id||'');
        const direct=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!special&&!direct)continue;
        const area=Math.max(1,r.width*r.height),depth=structuralKey(el).split('>').length;
        candidates.push({el,score:(special?1000000:0)+(direct?100000:0)+(el.id?10000:0)+depth*100-area/1000});
      }
      if(!generated&&candidates.length){candidates.sort((a,b)=>b.score-a.score);target=candidates[0].el}
      e.preventDefault();e.stopImmediatePropagation();window.selectElement(target);
    },true);
  }
  const frame=document.getElementById('previewFrame');
  if(frame){frame.onload=()=>{setTimeout(attachFrame,20)};setTimeout(attachFrame,80)}

  if(mediaPanel){
    mediaPanel.querySelector('#veChoose').onclick=async()=>{const picker=mediaPanel.querySelector('#vePicker');picker.style.display=picker.style.display==='none'?'block':'none';if(picker.style.display!=='none'){try{await loadMedia()}catch(e){status.textContent=e?.message||String(e)}}};
    search.oninput=renderMediaGrid;
    mediaPanel.querySelector('#vePlace').onclick=e=>{const b=e.target.closest('button[data-p]');if(!b||b.disabled)return;placement=b.dataset.p;mediaPanel.querySelectorAll('#vePlace button').forEach(x=>x.classList.toggle('active',x===b))};
    mediaPanel.querySelector('#veUse').onclick=()=>{if(picked<0||!mediaItems[picked]){status.textContent='Pick a media item first.';return}applySelected(mediaItems[picked]).catch(()=>{})};
    mediaPanel.querySelector('#veUpload').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{status.textContent='Uploading…';const rec=await uploadShared(file);mediaItems.unshift(rec);picked=0;renderMediaGrid();await applySelected(rec);await renderLibrary()}catch(err){status.textContent=err?.message||String(err)}finally{e.target.value=''}};
    removeMediaBtn.onclick=()=>removeSelectedMedia().catch(()=>{});
  }

  const mediaView=document.getElementById('view-media');
  if(mediaView){
    const old=document.getElementById('mediaUpload');
    if(old){const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.onchange=async()=>{try{for(const file of [...fresh.files])await uploadShared(file);await renderLibrary()}catch(e){alert(e?.message||String(e))}finally{fresh.value=''}}}
  }

  function mountHistory(){
    if(document.getElementById('veHistory'))return;const bar=document.querySelector('.previewbar');if(!bar)return;
    const group=document.createElement('div');group.id='veHistory';group.style.cssText='display:flex;gap:6px';
    group.innerHTML='<button class="btn" type="button" id="veUndo">↶ Undo</button><button class="btn" type="button" id="veRedo">↷ Redo</button>';
    bar.insertBefore(group,bar.querySelector('.spacer')||null);group.querySelector('#veUndo').onclick=()=>undo().catch(()=>{});group.querySelector('#veRedo').onclick=()=>redo().catch(()=>{});updateHistoryButtons();
  }
  mountHistory();
  document.addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey;if(!mod)return;const tag=document.activeElement?.tagName?.toLowerCase();if(['input','textarea','select'].includes(tag))return;if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo().catch(()=>{}):undo().catch(()=>{})}else if(e.key.toLowerCase()==='y'){e.preventDefault();redo().catch(()=>{})}});
  document.getElementById('previewPage')?.addEventListener('change',()=>{selected=null;updateMediaPanel()});
  renderLibrary();
})();