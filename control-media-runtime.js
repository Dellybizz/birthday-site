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
  function pageDataKey(page=pageName()){return page==='heart.html'?'heart':page==='yapping.html'?'yapping':null}
  function modelBinding(el=previewElement()){
    const node=el?.closest?.('[data-model-page][data-model-index]');if(!node)return null;
    const page=node.dataset.modelPage,index=Number(node.dataset.modelIndex);
    if(!Number.isInteger(index)||index<0||!['heart','yapping'].includes(page))return null;
    return {node,page,index};
  }
  function modelRecord(binding){
    if(!binding)return null;
    if(binding.page==='heart')return state.pages?.heart?.memories?.[binding.index]||null;
    if(binding.page==='yapping')return state.pages?.yapping?.clips?.[binding.index]||null;
    return null;
  }
  function ensureModelData(binding){
    state.pages??={};
    if(binding.page==='heart'){
      state.pages.heart??={memories:[]};state.pages.heart.memories??=[];
      const defaults=[
        ["memory 01","one of my favourites.","image"],["memory 02","saved immediately.","image"],["memory 03","tiny video memory.","video"],["memory 04","this one stays.","image"],["memory 05","quiet favourite.","image"],
        ["memory 06","the funny one.","video"],["memory 07","I still remember this.","image"],["memory 08","very random, very us.","image"],["memory 09","peak nonsense.","video"],["memory 10","you probably forgot this.","image"],
        ["memory 11","small but important.","image"],["memory 12","one of those clips.","video"],["memory 13","top tier.","image"],["memory 14","never deleting this.","image"],["memory 15","yes, this one.","video"],
        ["memory 16","case closed.","image"],["memory 17","another favourite.","image"],["memory 18","one more clip.","video"],["memory 19","bonus memory.","image"],["memory 20","you thought I was done?","image"]
      ];
      while(state.pages.heart.memories.length<20){const i=state.pages.heart.memories.length,d=defaults[i];state.pages.heart.memories.push({title:d[0],note:d[1],mediaType:d[2],mediaUrl:""})}
      return state.pages.heart.memories[binding.index];
    }
    state.pages.yapping??={clips:[]};state.pages.yapping.clips??=[];
    const defaults=[["session 001","topic lost at 00:43"],["session 002","side quest detected"],["session 003","actually funny"],["session 004","still talking"],["session 005","no conclusion"]];
    while(state.pages.yapping.clips.length<5){const i=state.pages.yapping.clips.length,d=defaults[i];state.pages.yapping.clips.push({title:d[0],note:d[1],src:"",mediaType:"video"})}
    return state.pages.yapping.clips[binding.index];
  }
  function updateModelPreview(binding,record){
    const win=currentWin();if(!binding||!win)return;
    if(binding.page==='heart')win.HEART_MEMORY_APP?.updateMemory?.(binding.index,record);
    if(binding.page==='yapping')win.YAPPING_ARCHIVE?.updateClip?.(binding.index,record);
  }
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
  function editSnapshot(){const key=pageDataKey();return {page:pageName(),selector:selected?.selector||'',patches:clone(pagePatches()),pageDataKey:key,pageData:key?clone(state.pages?.[key]||{}):null}}
  function updateHistoryButtons(){const u=document.getElementById('veUndo'),r=document.getElementById('veRedo');if(u)u.disabled=!undoStack.length||historyBusy;if(r)r.disabled=!redoStack.length||historyBusy}
  function pushHistory(){if(historyBusy)return;undoStack.push(editSnapshot());if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack=[];updateHistoryButtons()}
  async function publishNoReload(){const result=await save({reload:false});if(!result)throw new Error('Publish did not complete.');return result}
  async function restoreHistory(entry,targetStack){
    if(!entry||historyBusy)return;historyBusy=true;updateHistoryButtons();
    const current=editSnapshot();targetStack.push(current);if(targetStack.length>HISTORY_LIMIT)targetStack.shift();
    try{
      state.patches[entry.page]=clone(entry.patches);if(entry.pageDataKey){state.pages??={};state.pages[entry.pageDataKey]=clone(entry.pageData||{});}dirty();
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
  async function deleteShared(rec,force=false){
    const key=adminKey();if(!key)throw new Error('Unlock the Control Room first.');
    const path=String(rec?.path||'');if(!path)throw new Error('This media record has no deletable storage path.');
    const r=await fetch(MEDIA_ENDPOINT,{method:'DELETE',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({path,force:!!force})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){
      const err=new Error(j.error||'Delete failed');
      Object.assign(err,j,{status:r.status});
      throw err;
    }
    mediaItems=mediaItems.filter(item=>item.path!==path);return j;
  }
  function friendlyMediaLocation(path){
    const p=String(path||'');
    let m;
    if(p==='general.favoritePhoto')return 'Finale → favorite photo';
    if(p==='general.musicFile')return 'Soundtrack → legacy shared song';
    if((m=p.match(/^general\.soundtrack\.defaultTracks\[(\d+)\]\.url$/)))return 'Soundtrack → default playlist → track '+(Number(m[1])+1);
    if((m=p.match(/^general\.soundtrack\.pageTracks\["([^"]+)"\]\[(\d+)\]\.url$/)))return 'Soundtrack → '+m[1]+' → track '+(Number(m[2])+1);
    if((m=p.match(/^general\.soundtrack\.pageTracks\.([^.\[]+)\[(\d+)\]\.url$/)))return 'Soundtrack → '+m[1]+' → track '+(Number(m[2])+1);
    if((m=p.match(/^pages\.yapping\.clips\[(\d+)\]\.(?:src|mediaUrl)$/)))return 'Yapping Archive → clip '+(Number(m[1])+1);
    if((m=p.match(/^pages\.heart\.memories\[(\d+)\]\.(?:mediaUrl|src)$/)))return 'Heart → memory '+(Number(m[1])+1);
    if((m=p.match(/^pages\.pretty(?:\.photos)?\[(\d+)\]/)))return 'Pretty Photos → item '+(Number(m[1])+1);
    if((m=p.match(/^pages\.memories(?:\.items)?\[(\d+)\]/)))return 'Memories → item '+(Number(m[1])+1);
    if((m=p.match(/^fairPhotos\.([^.\[]+)\.(hero|photo\d+)$/))){
      const label=m[2]==='hero'?'hero photo':'photo '+(Number(m[2].replace('photo',''))+1);
      return 'Fair → '+m[1]+' → '+label;
    }
    if((m=p.match(/^patches\["([^"]+)"\]\[(\d+)\]/)))return 'Visual Editor → '+m[1]+' → patch '+(Number(m[2])+1);
    if((m=p.match(/^patches\.([^.\[]+)\[(\d+)\]/)))return 'Visual Editor → '+m[1]+' → patch '+(Number(m[2])+1);
    return p.replace(/^\$\.?/,'')||'live site';
  }
  function mediaDeleteWarning(rec,details){
    const live=Array.isArray(details?.liveLocations)?details.liveLocations:[];
    const history=Array.isArray(details?.historyMatches)?details.historyMatches:[];
    const lines=[];
    if(live.length){
      lines.push('THIS FILE IS CURRENTLY IN USE IN:');
      live.slice(0,12).forEach(path=>lines.push('• '+friendlyMediaLocation(path)));
      if(live.length>12)lines.push('• +'+(live.length-12)+' more live reference'+(live.length-12===1?'':'s'));
      lines.push('');
      lines.push('Deleting it will make the media disappear or break in those places until you replace it.');
    }else lines.push('This file is not used by the current live site.');
    if(history.length){
      const revisions=history.map(item=>item.revision).filter(Boolean);
      lines.push('');
      lines.push('It is also referenced by '+history.length+' saved history revision'+(history.length===1?'':'s')+(revisions.length?' ('+revisions.slice(0,12).join(', ')+(revisions.length>12?', …':'')+')':'')+'.');
    }
    lines.push('');
    lines.push('Delete this file permanently anyway?');
    return lines.join('\n');
  }
  async function deleteMediaWithWarning(rec){
    try{
      if(!rec?.referencedLive&&!Number(rec?.historyReferences||0)){
        if(!confirm('Permanently delete "'+label(rec)+'" from the Media Library?'))return false;
        await deleteShared(rec,false);return true;
      }
      try{
        await deleteShared(rec,false);
        return true;
      }catch(err){
        if(err?.code!=='MEDIA_REFERENCED')throw err;
        if(!confirm(mediaDeleteWarning(rec,err)))return false;
        await deleteShared(rec,true);return true;
      }
    }catch(err){throw err}
  }
  window.__birthdayUploadShared=uploadShared;
  window.__birthdayListShared=sharedMedia;
  window.__birthdayDeleteShared=deleteShared;
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
    const binding=modelBinding(el),record=modelRecord(binding),p=findPatch(selected?.selector||''),owner=ownerForSelection();
    const modelHasMedia=binding?(binding.page==='heart'?!!record?.mediaUrl:!!record?.src):false;
    removeMediaBtn.disabled=!(modelHasMedia||owner||(directMedia(el)&&p?.src));
  }
  async function applySelected(rec){
    const el=previewElement();if(!el||!mediaSlot(el))throw new Error('Select an explicit media slot first.');
    if(!rec?.url)throw new Error('Pick media first.');
    pushHistory();
    const binding=modelBinding(el);
    if(binding){
      const record=ensureModelData(binding),mediaKind=kind(rec);
      if(binding.page==='yapping'&&!['video','audio'].includes(mediaKind))throw new Error('Yapping clips support video or audio files.');
      if(binding.page==='heart'){record.mediaUrl=rec.url;record.mediaType=mediaKind}
      else{record.src=rec.url;record.mediaType=mediaKind}
      state.patches[pageName()]=pagePatches().filter(p=>stableSelector(p?.selector)!==stableSelector(selected.selector));
      dirty();updateModelPreview(binding,clone(record));status.textContent='Publishing…';
      try{await publishNoReload();status.textContent='Media updated.';updateMediaPanel();return}catch(e){status.textContent=e?.message||String(e);throw e}
    }
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
    const binding=modelBinding(el);
    if(binding){
      const record=ensureModelData(binding),hasMedia=binding.page==='heart'?!!record.mediaUrl:!!record.src;
      if(!hasMedia){status.textContent='No media is attached to this slot.';return}
      pushHistory();
      if(binding.page==='heart')record.mediaUrl='';else record.src='';
      dirty();updateModelPreview(binding,clone(record));status.textContent='Publishing removal…';
      try{await publishNoReload();status.textContent='Media removed.';updateMediaPanel();return}catch(e){status.textContent=e?.message||String(e);throw e}
    }
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
        const card=document.createElement('div');card.className='media-card';const k=kind(rec);
        const liveUsed=!!rec.referencedLive;
        const historyOnly=!liveUsed&&Number(rec.historyReferences||0)>0;
        const usage=liveUsed
          ?'Used by live site'
          :historyOnly
            ?'Not live · kept by history ('+Number(rec.historyReferences||0)+' snapshot'+(Number(rec.historyReferences||0)===1?'':'s')+')'
            :'Unused · safe to delete';
        const actionLabel=liveUsed?'Delete anyway':historyOnly?'Delete anyway':'Delete';
        const actionTitle=liveUsed
          ?'Delete this file even though the live site currently uses it. A warning will show the exact places first.'
          :historyOnly
            ?'Delete this file even though old history revisions reference it. A warning will appear first.'
            :'Permanently delete this unused media file.';
        const preview=k==='image'?'<img src="'+attr(rec.url)+'" alt="">':k==='video'?'<video src="'+attr(rec.url)+'" muted playsinline preload="metadata"></video>':'<audio controls src="'+attr(rec.url)+'"></audio>';
        card.innerHTML='<div class="media-thumb">'+preview+'</div><div class="media-meta"><b>'+esc(label(rec))+'</b><small>'+esc(rec.url||'')+'</small><small>'+esc(usage)+'</small><div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap"><button class="btn" data-copy type="button">Copy URL</button><button class="btn danger" data-delete type="button" title="'+attr(actionTitle)+'">'+actionLabel+'</button></div></div>';
        card.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(rec.url||'');toast('URL copied')}catch(e){}};
        const del=card.querySelector('[data-delete]');
        if(del)del.onclick=async()=>{
          const original=del.textContent;
          try{
            del.disabled=true;del.textContent='Checking…';
            const deleted=await deleteMediaWithWarning(rec);
            if(!deleted){del.disabled=false;del.textContent=original;return}
            toast('Media deleted');
            await renderLibrary();
            window.renderYappingManager?.();
          }catch(e){
            del.disabled=false;del.textContent=original;
            alert(e?.message||String(e));
          }
        };
        card.appendChild(document.createTextNode(''));
        box.appendChild(card);
      }
      if(!mediaItems.length)box.innerHTML='<div class="empty">No media uploaded yet.</div>';
    }catch(e){box.innerHTML='<div class="empty">Could not load media: '+esc(e?.message||String(e))+'</div>'}
  }
  window.renderMedia=renderLibrary;window.listMedia=sharedMedia;

  function countdownTextBinding(el){
    if(pageName()!=='countdown.html'||!el)return null;
    const owner=el.id?el:el.closest?.('[id]');
    const id=owner?.id||'';
    if(id==='lockDialogTitle')return {path:['pages','countdown','access','title']};
    if(id==='lockDialogText')return {path:['pages','countdown','access','text']};
    let key='';
    if(id==='eyebrow')key='eyebrow';
    else if(id==='sub')key='sub';
    else if(id==='lockLabel')key='lockLabel';
    else if(id==='lockNote')key='lockNote';
    else if(id==='title'&&el.tagName==='EM')key='titleEmphasis';
    if(!key)return null;
    let mode=document.getElementById('countdownPreviewState')?.value||'auto';
    if(!['before','after'].includes(mode))mode=currentWin()?.COUNTDOWN_PAGE?.isAfter?.()?'after':'before';
    return {path:['pages','countdown',mode,key],mode,key};
  }
  function readStatePath(path){
    return path.reduce((value,key)=>value?.[key],state);
  }
  function writeStatePath(path,value){
    let target=state;
    for(const key of path.slice(0,-1))target=target[key]??={};
    target[path[path.length-1]]=value;
  }
  function syncCountdownDraft(){
    try{currentWin()?.COUNTDOWN_PAGE?.applyState?.(state)}catch(e){}
  }

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
    pushHistory();const p=patchFor(selected.selector),t=document.getElementById('iText'),countdownBinding=countdownTextBinding(el);
    if(t&&textEditable(el)){
      if(countdownBinding){writeStatePath(countdownBinding.path,t.value);delete p.text}
      else p.text=t.value;
    }else delete p.text;
    const hidden=document.getElementById('iHidden');if(hidden)p.hidden=hidden.checked;
    p.styles={color:document.getElementById('iColor')?.value||'','background-color':document.getElementById('iBg')?.value||'','font-size':document.getElementById('iSize')?.value||'',opacity:document.getElementById('iOpacity')?.value||'','border-radius':document.getElementById('iRadius')?.value||'',transform:document.getElementById('iTransform')?.value||''};
    const href=document.getElementById('iHref');if(href&&el.matches('a'))p.href=href.value;else delete p.href;
    prunePatch(p);dirty();if(countdownBinding)syncCountdownDraft();else livePreview();
    const result=await publishNoReload();if(result)toast(countdownBinding?'Countdown text updated':'Element updated');
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
    const p=findPatch(selector)||{selector,styles:{}},style=fieldStyle(el,p),canText=textEditable(el),isLink=el.matches('a'),countdownBinding=countdownTextBinding(el);
    const inspectorText=countdownBinding?(readStatePath(countdownBinding.path)??el.textContent.trim()):(p.text??el.textContent.trim());
    fields.innerHTML=(canText?'<div class="field"><label>Text</label><textarea id="iText">'+esc(inspectorText)+'</textarea></div>':'<div class="ve-note">Container text editing is disabled to protect child elements. Select the actual text element instead.</div>')+
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
    bindSelectedAnimationInspector(el).catch(()=>{});
  }
  window.cssSelector=selectorFor;
  window.currentPatch=selector=>findPatch(selector)||{selector,styles:{}};
  window.selectElement=function(clicked){
    if(!clicked)return;
    const modelNode=clicked.closest?.('[data-model-page][data-model-index]');if(modelNode)clicked=modelNode;
    let token=clicked.dataset?.bdayInserted||'',el=clicked,selector='';
    if(token){
      const owner=generatedOwnerByToken(token);if(owner){selector=owner.patch.selector;el=lookup(selector)||clicked}
    }
    if(!selector)selector=selectorFor(el);
    if(!selector||GENERATED.test(selector))return;
    renderInspector(el,selector,token);
  };
  window.saveInspectorPatch=applyInspector;window.removeInspectorPatch=removeOverride;

  let selectedAnimation={owner:null,trigger:null,label:'Animation',animations:[],timers:[]};
  function animationDuration(animation){
    try{
      const timing=animation.effect?.getComputedTiming?.()||animation.effect?.getTiming?.()||{};
      const end=Number(timing.endTime);
      if(Number.isFinite(end)&&end>0)return end;
      const duration=Number(timing.duration);
      return Number.isFinite(duration)&&duration>0?duration:1000;
    }catch(e){return 1000}
  }
  function relatedAnimations(owner){
    const doc=currentDoc();if(!doc||!owner)return [];
    return (doc.getAnimations?.()||[]).filter(animation=>{
      const target=animation.effect?.target;
      return !!target&&(target===owner||owner.contains?.(target));
    });
  }
  function interactionAnimationFor(el){
    const doc=currentDoc();if(!doc||!el)return null;
    if(pageName()==='index.html'){
      const envelope=el.closest?.('#envelope')||(el.id==='envelope'?el:null);
      if(envelope){
        return {owner:envelope,trigger:doc.getElementById('sealBtn'),label:'Envelope opening',autoCapture:true};
      }
    }
    const active=relatedAnimations(el);
    if(active.length)return {owner:el,trigger:null,label:'Animation',animations:active,autoCapture:false};
    const trigger=el.matches?.('button,a,[role="button"]')?el:el.querySelector?.('button,[role="button"]');
    if(trigger)return {owner:el,trigger,label:'Interaction animation',autoCapture:false};
    return null;
  }
  function clearCapturedTimers(){
    const win=currentWin();
    if(win)for(const id of selectedAnimation.timers||[])try{win.clearTimeout(id)}catch(e){}
    for(const animation of selectedAnimation.animations||[])try{animation.cancel()}catch(e){}
    selectedAnimation.timers=[];selectedAnimation.animations=[];
  }
  function setSelectedAnimationProgress(progress){
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    for(const animation of selectedAnimation.animations||[]){
      try{animation.pause();animation.currentTime=p*animationDuration(animation)}catch(e){}
    }
    const value=document.getElementById('veSelectedAnimValue');if(value)value.textContent=Math.round(p*100)+'%';
    const range=document.getElementById('veSelectedAnimRange');if(range&&Number(range.value)!==Math.round(p*1000))range.value=String(Math.round(p*1000));
  }
  function resetKnownInteraction(owner){
    const doc=currentDoc();if(!doc||!owner)return;
    if(pageName()==='index.html'&&owner.id==='envelope'){
      owner.classList.remove('open');
      doc.getElementById('sealBtn')?.classList.remove('hidden');
      const caption=doc.getElementById('envelopeCaption');if(caption)caption.textContent='tap the seal to open it';
    }
  }
  async function captureSelectedAnimation(candidate){
    const win=currentWin(),doc=currentDoc();if(!win||!doc||!candidate?.owner||!candidate?.trigger)return false;
    clearCapturedTimers();resetKnownInteraction(candidate.owner);
    await new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)));

    const nativeTimeout=win.setTimeout,originalTimeout=nativeTimeout.bind(win),captured=[];
    win.setTimeout=(fn,delay,...args)=>{
      const id=originalTimeout(fn,delay,...args);
      captured.push({id,delay:Number(delay)||0});
      return id;
    };
    const previousInteract=window.__previewInteractMode;
    window.__previewInteractMode=true;
    try{candidate.trigger.click()}catch(e){}
    finally{
      win.setTimeout=nativeTimeout;
      window.__previewInteractMode=previousInteract;
    }
    selectedAnimation.timers=captured.map(x=>x.id);
    captured.filter(x=>x.delay>=120).forEach(x=>{try{win.clearTimeout(x.id)}catch(e){}});
    await new Promise(resolve=>originalTimeout(resolve,40));

    const animations=relatedAnimations(candidate.owner);
    animations.forEach(animation=>{try{animation.pause()}catch(e){}});
    selectedAnimation={...candidate,animations,timers:selectedAnimation.timers||[]};
    setSelectedAnimationProgress(0);
    return animations.length>0;
  }
  function animationInspectorMarkup(candidate){
    if(!candidate)return '';
    const hasAnimations=(candidate.animations||relatedAnimations(candidate.owner)).length>0;
    const capture=candidate.trigger?'<button class="btn" type="button" id="veCaptureAnimation">'+(candidate.autoCapture?'Reload animation':'Capture animation')+'</button>':'';
    return '<div class="ve-selected-animation" id="veSelectedAnimation">'+
      '<div class="ve-selected-animation-head"><div><b>'+esc(candidate.label)+'</b><small>Drag to the exact point you want to edit.</small></div>'+capture+'</div>'+
      '<div class="ve-selected-animation-slider"><input id="veSelectedAnimRange" type="range" min="0" max="1000" value="0" '+(hasAnimations?'':'disabled')+'><span id="veSelectedAnimValue">0%</span></div>'+
      '<div class="ve-note" id="veSelectedAnimNote">'+(hasAnimations?'Animation ready.':'Click Capture animation to load this interaction.')+'</div>'+
    '</div>';
  }
  async function bindSelectedAnimationInspector(el){
    const candidate=interactionAnimationFor(el);
    if(!candidate)return;
    const existing=relatedAnimations(candidate.owner);
    selectedAnimation={...candidate,animations:existing,timers:[]};
    const holder=document.createElement('div');
    holder.innerHTML=animationInspectorMarkup({...candidate,animations:existing});
    const node=holder.firstElementChild;
    const actions=document.getElementById('applyPatch')?.parentElement;
    if(actions)actions.before(node);else fields.appendChild(node);

    const range=node.querySelector('#veSelectedAnimRange');
    if(existing.length){
      existing.forEach(animation=>{try{animation.pause()}catch(e){}});
      let progress=0;
      try{progress=Math.max(0,Math.min(1,Number(existing[0].currentTime||0)/animationDuration(existing[0])))}catch(e){}
      range.value=String(Math.round(progress*1000));
      node.querySelector('#veSelectedAnimValue').textContent=Math.round(progress*100)+'%';
      range.disabled=false;
    }
    range.oninput=()=>setSelectedAnimationProgress(Number(range.value)/1000);

    const capture=node.querySelector('#veCaptureAnimation');
    if(capture)capture.onclick=async()=>{
      capture.disabled=true;capture.textContent='Loading…';
      const ok=await captureSelectedAnimation(candidate);
      range.disabled=!ok;
      node.querySelector('#veSelectedAnimNote').textContent=ok?'Animation ready — drag the slider.':'No scrub-able animation was detected for this interaction.';
      capture.disabled=false;capture.textContent='Reload animation';
    };
    if(candidate.autoCapture&&!existing.length&&capture)capture.click();
  }


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
  if(frame){frame.addEventListener('load',()=>{clearCapturedTimers();selectedAnimation={owner:null,trigger:null,label:'Animation',animations:[],timers:[]};setTimeout(attachFrame,20)});setTimeout(attachFrame,80)}

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
  const YAPPING_DEFAULTS=[
    {title:'session 001',note:'topic lost at 00:43',src:'',mediaType:'video'},
    {title:'session 002',note:'side quest detected',src:'',mediaType:'video'},
    {title:'session 003',note:'actually funny',src:'',mediaType:'video'},
    {title:'session 004',note:'still talking',src:'',mediaType:'video'},
    {title:'session 005',note:'no conclusion',src:'',mediaType:'video'}
  ];
  function yappingClips(){
    state.pages??={};state.pages.yapping??={};
    if(!Array.isArray(state.pages.yapping.clips))state.pages.yapping.clips=clone(YAPPING_DEFAULTS);
    return state.pages.yapping.clips;
  }
  function yappingTitle(index){return 'session '+String(index+1).padStart(3,'0')}
  function yappingVideoItems(){return mediaItems.filter(rec=>kind(rec)==='video')}
  function yappingPreviewHtml(clip){
    if(clip?.src)return '<video src="'+attr(clip.src)+'" controls muted playsinline preload="metadata"></video>';
    return '<span>No video yet</span>';
  }
  function yappingMediaOptions(selectedUrl=''){
    const options=['<option value="">Choose an uploaded video…</option>'];
    for(const rec of yappingVideoItems())options.push('<option value="'+attr(rec.url)+'" '+(rec.url===selectedUrl?'selected':'')+'>'+esc(label(rec))+'</option>');
    return options.join('');
  }
  async function renderYappingManager(refreshMedia=false){
    const box=document.getElementById('yappingClipManager');if(!box)return;
    if(refreshMedia||!mediaItems.length){
      try{await sharedMedia()}catch(e){box.innerHTML='<div class="empty">'+esc(e?.message||String(e))+'</div>';return}
    }
    const clips=yappingClips();
    box.innerHTML='';
    if(!clips.length){
      box.innerHTML='<div class="empty">No clips yet. Use <b>Add videos</b> to upload one or more videos.</div>';
      return;
    }
    clips.forEach((clip,index)=>{
      const row=document.createElement('div');row.className='yap-row';row.dataset.index=String(index);
      row.innerHTML=
        '<div class="yap-preview">'+yappingPreviewHtml(clip)+'</div>'+
        '<div class="yap-fields">'+
          '<div class="row">'+
            '<div class="field"><label>Session title</label><input data-yap-title value="'+attr(clip?.title||yappingTitle(index))+'"></div>'+
            '<div class="field"><label>Archive note</label><input data-yap-note value="'+attr(clip?.note||'')+'"></div>'+
          '</div>'+
          '<div class="yap-meta">'+(clip?.src?esc(clip.src):'No video attached')+'</div>'+
          '<div class="yap-existing"><select data-yap-existing>'+yappingMediaOptions(clip?.src||'')+'</select><button class="btn" type="button" data-yap-use>Use selected</button></div>'+
          '<div class="yap-actions">'+
            '<label class="btn upload">Replace upload<input data-yap-upload type="file" accept="video/mp4,video/webm"></label>'+
            '<button class="btn" type="button" data-yap-clear>Clear video</button>'+
            '<button class="btn" type="button" data-yap-up '+(index===0?'disabled':'')+'>↑ Up</button>'+
            '<button class="btn" type="button" data-yap-down '+(index===clips.length-1?'disabled':'')+'>↓ Down</button>'+
            '<button class="btn danger" type="button" data-yap-remove>Remove clip</button>'+
          '</div>'+
        '</div>';

      const title=row.querySelector('[data-yap-title]'),note=row.querySelector('[data-yap-note]');
      title.oninput=()=>{clip.title=title.value;dirty()};
      note.oninput=()=>{clip.note=note.value;dirty()};

      row.querySelector('[data-yap-use]').onclick=()=>{
        const sel=row.querySelector('[data-yap-existing]'),url=sel.value;
        if(!url){toast('Choose an uploaded video first');return}
        clip.src=url;clip.mediaType='video';dirty();renderYappingManager(false);toast('Video attached — publish to save');
      };
      row.querySelector('[data-yap-upload]').onchange=async e=>{
        const file=e.target.files?.[0];if(!file)return;
        try{
          if(!String(file.type||'').startsWith('video/'))throw new Error('Choose an MP4 or WebM video.');
          toast('Uploading '+file.name+'…');
          const rec=await uploadShared(file);
          if(kind(rec)!=='video')throw new Error('The uploaded file is not a supported video.');
          mediaItems.unshift(rec);clip.src=rec.url;clip.mediaType='video';
          if(!clip.title||/^session \d+$/i.test(clip.title))clip.title=file.name.replace(/\.[^.]+$/,'')||clip.title;
          dirty();await renderYappingManager(false);toast('Video ready — publish to save');
        }catch(err){alert(err?.message||String(err))}finally{e.target.value=''}
      };
      row.querySelector('[data-yap-clear]').onclick=()=>{clip.src='';clip.mediaType='video';dirty();renderYappingManager(false);toast('Video cleared — publish to save')};
      row.querySelector('[data-yap-up]').onclick=()=>{if(index<1)return;[clips[index-1],clips[index]]=[clips[index],clips[index-1]];dirty();renderYappingManager(false)};
      row.querySelector('[data-yap-down]').onclick=()=>{if(index>=clips.length-1)return;[clips[index+1],clips[index]]=[clips[index],clips[index+1]];dirty();renderYappingManager(false)};
      row.querySelector('[data-yap-remove]').onclick=()=>{if(!confirm('Remove this Yapping Archive clip? The uploaded file itself stays in Media Library.'))return;clips.splice(index,1);dirty();renderYappingManager(false);toast('Clip removed — publish to save')};
      box.appendChild(row);
    });
  }
  window.renderYappingManager=()=>renderYappingManager(false);

  const yappingAdd=document.getElementById('yappingAddVideos');
  if(yappingAdd)yappingAdd.onchange=async()=>{
    const files=[...(yappingAdd.files||[])];if(!files.length)return;
    const clips=yappingClips();
    try{
      for(const file of files){
        if(!String(file.type||'').startsWith('video/'))throw new Error(file.name+' is not a video.');
        if(clips.length>=50)throw new Error('The Yapping Archive supports up to 50 clips.');
        toast('Uploading '+file.name+'…');
        const rec=await uploadShared(file);
        if(kind(rec)!=='video')throw new Error(file.name+' is not a supported video.');
        mediaItems.unshift(rec);
        const empty=clips.findIndex(item=>!item?.src);
        if(empty>=0){
          clips[empty]={...clips[empty],src:rec.url,mediaType:'video'};
          if(!clips[empty].title||/^session \d+$/i.test(clips[empty].title))clips[empty].title=file.name.replace(/\.[^.]+$/,'')||yappingTitle(empty);
        }else{
          clips.push({title:file.name.replace(/\.[^.]+$/,'')||yappingTitle(clips.length),note:'archived yapping evidence',src:rec.url,mediaType:'video'});
        }
      }
      dirty();await renderYappingManager(false);toast(files.length+' video'+(files.length===1?'':'s')+' added — publish to save');
    }catch(e){alert(e?.message||String(e))}finally{yappingAdd.value=''}
  };
  document.getElementById('yappingAddEmpty')?.addEventListener('click',()=>{
    const clips=yappingClips();if(clips.length>=50){alert('The Yapping Archive supports up to 50 clips.');return}
    clips.push({title:yappingTitle(clips.length),note:'archived yapping evidence',src:'',mediaType:'video'});dirty();renderYappingManager(false);
  });
  document.getElementById('yappingRefreshMedia')?.addEventListener('click',()=>renderYappingManager(true));
  document.getElementById('nav')?.addEventListener('click',e=>{
    const y=e.target.closest('button[data-view="yapping"]');if(y)setTimeout(()=>renderYappingManager(true),0);
    const g=e.target.closest('button[data-view="general"]');if(g)setTimeout(()=>renderSoundtrackManager(true),0);
  });
  renderYappingManager(false);

  const SOUND_PAGES=[
    ['countdown.html','Countdown'],['index.html','Entry'],['memories.html','Memories'],['pretty-photos.html','Pretty Photos'],
    ['heart.html','Heart'],['yapping.html','Yapping'],['fair.html','Fair'],['finale.html','Finale']
  ];
  function ensureSoundtrackModel(){
    state.general??={};
    if(!state.general.soundtrack||typeof state.general.soundtrack!=='object'||Array.isArray(state.general.soundtrack)){
      const legacy=String(state.general.musicFile||'').trim();
      state.general.soundtrack={defaultTracks:legacy?[{url:legacy,name:'Shared soundtrack'}]:[],pageTracks:{},shuffle:false};
    }
    const model=state.general.soundtrack;
    if(!Array.isArray(model.defaultTracks))model.defaultTracks=[];
    if(!model.pageTracks||typeof model.pageTracks!=='object'||Array.isArray(model.pageTracks))model.pageTracks={};
    model.shuffle=!!model.shuffle;
    return model;
  }
  function audioItems(){return mediaItems.filter(item=>kind(item)==='audio')}
  function trackName(track,index){return String(track?.name||('Track '+(index+1)))}
  function cleanTrack(rec){return {url:String(rec?.url||''),name:label(rec)}}
  function soundtrackMediaOptions(){
    const options=['<option value="">Choose audio from Media Library…</option>'];
    audioItems().forEach((rec,index)=>options.push('<option value="'+index+'">'+esc(label(rec))+'</option>'));
    return options.join('');
  }
  function renderTrackList(list,container,scope,page=''){
    container.innerHTML='';
    if(!list.length){container.innerHTML='<div class="ve-anim-empty">'+(scope==='page'?'This page is silent because its custom playlist is empty.':'No default songs yet.')+'</div>';return}
    list.forEach((track,index)=>{
      const row=document.createElement('div');row.className='sound-track-row';
      row.innerHTML='<div class="sound-track-main"><input data-track-name value="'+attr(trackName(track,index))+'"><small>'+esc(track.url||'')+'</small></div><div class="sound-track-actions"><button class="btn" type="button" data-up '+(index===0?'disabled':'')+'>↑</button><button class="btn" type="button" data-down '+(index===list.length-1?'disabled':'')+'>↓</button><button class="btn danger" type="button" data-remove>Remove</button></div>';
      row.querySelector('[data-track-name]').oninput=e=>{track.name=e.target.value;dirty()};
      row.querySelector('[data-up]').onclick=()=>{if(index<1)return;[list[index-1],list[index]]=[list[index],list[index-1]];dirty();renderSoundtrackManager(false)};
      row.querySelector('[data-down]').onclick=()=>{if(index>=list.length-1)return;[list[index+1],list[index]]=[list[index],list[index+1]];dirty();renderSoundtrackManager(false)};
      row.querySelector('[data-remove]').onclick=()=>{list.splice(index,1);dirty();renderSoundtrackManager(false)};
      container.appendChild(row);
    });
  }
  let soundtrackPage='countdown.html';
  async function renderSoundtrackManager(refreshMedia=false){
    const root=document.getElementById('soundtrackManager');if(!root)return;
    const model=ensureSoundtrackModel();
    const soundDefaultToggle=root.querySelector('#soundDefaultOn');if(soundDefaultToggle)soundDefaultToggle.checked=!!state.general.soundDefault;
    if(refreshMedia||!mediaItems.length){try{await sharedMedia()}catch(e){}}
    const defaultList=root.querySelector('#soundDefaultTracks');
    renderTrackList(model.defaultTracks,defaultList,'default');
    const existing=root.querySelector('#soundDefaultExisting');if(existing)existing.innerHTML=soundtrackMediaOptions();
    const shuffle=root.querySelector('#soundShuffle');if(shuffle)shuffle.checked=!!model.shuffle;
    const pageSelect=root.querySelector('#soundPageSelect');
    if(pageSelect){
      pageSelect.innerHTML=SOUND_PAGES.map(([value,name])=>'<option value="'+value+'" '+(value===soundtrackPage?'selected':'')+'>'+name+'</option>').join('');
    }
    const hasOverride=Object.prototype.hasOwnProperty.call(model.pageTracks,soundtrackPage);
    const override=root.querySelector('#soundPageOverride');if(override)override.checked=hasOverride;
    const pageArea=root.querySelector('#soundPageArea');if(pageArea)pageArea.style.display=hasOverride?'block':'none';
    if(hasOverride){
      const list=Array.isArray(model.pageTracks[soundtrackPage])?model.pageTracks[soundtrackPage]:(model.pageTracks[soundtrackPage]=[]);
      renderTrackList(list,root.querySelector('#soundPageTracks'),'page',soundtrackPage);
      root.querySelector('#soundPageExisting').innerHTML=soundtrackMediaOptions();
    }
  }
  function mountSoundtrackManager(){
    const old=document.getElementById('soundtrackUpload');const card=old?.closest('.card');if(!card||document.getElementById('soundtrackManager'))return;
    card.innerHTML='<h3>Soundtrack</h3><div id="soundtrackManager"><div class="toggle"><div><b>Sound on by default</b><div class="help">Browser autoplay rules may still require the visitor\'s first interaction.</div></div><label class="switch"><input type="checkbox" id="soundDefaultOn"><i></i></label></div><div class="toggle"><div><b>Shuffle playlists</b><div class="help">Off = play songs in order. On = choose another song randomly when one finishes.</div></div><label class="switch"><input type="checkbox" id="soundShuffle"><i></i></label></div><div class="sound-section"><h4>Default playlist · all pages</h4><div class="help">One song here = one song everywhere. Multiple songs here = playlist everywhere unless a page has its own override.</div><div id="soundDefaultTracks" class="sound-track-list"></div><div class="sound-add-row"><label class="btn upload">Upload songs<input id="soundDefaultUpload" type="file" multiple accept="audio/*"></label><select id="soundDefaultExisting"></select><button class="btn" id="soundDefaultAddExisting" type="button">Add selected</button></div></div><div class="sound-section"><h4>Per-page soundtrack</h4><div class="field"><label>Page</label><select id="soundPageSelect"></select></div><div class="toggle"><div><b>Use custom playlist on this page</b><div class="help">Turn on to override the default playlist. Leave its list empty to make this page silent.</div></div><label class="switch"><input type="checkbox" id="soundPageOverride"><i></i></label></div><div id="soundPageArea" style="display:none"><div id="soundPageTracks" class="sound-track-list"></div><div class="sound-add-row"><label class="btn upload">Upload songs<input id="soundPageUpload" type="file" multiple accept="audio/*"></label><select id="soundPageExisting"></select><button class="btn" id="soundPageAddExisting" type="button">Add selected</button></div><button class="btn" id="soundPageUseDefault" type="button" style="margin-top:8px">Remove override · use default</button></div></div><div class="help" style="margin-top:10px">The old shared soundtrack URL is kept only as a compatibility fallback until this playlist model is published.</div></div>';
    const root=document.getElementById('soundtrackManager'),model=ensureSoundtrackModel();
    root.querySelector('#soundDefaultOn').checked=!!state.general.soundDefault;
    root.querySelector('#soundDefaultOn').onchange=e=>{state.general.soundDefault=e.target.checked;dirty()};
    root.querySelector('#soundShuffle').onchange=e=>{ensureSoundtrackModel().shuffle=e.target.checked;dirty()};
    root.querySelector('#soundPageSelect').onchange=e=>{soundtrackPage=e.target.value;renderSoundtrackManager(false)};
    root.querySelector('#soundPageOverride').onchange=e=>{
      const model=ensureSoundtrackModel();
      if(e.target.checked){if(!Object.prototype.hasOwnProperty.call(model.pageTracks,soundtrackPage))model.pageTracks[soundtrackPage]=[]}
      else delete model.pageTracks[soundtrackPage];
      dirty();renderSoundtrackManager(false);
    };
    root.querySelector('#soundPageUseDefault').onclick=()=>{delete ensureSoundtrackModel().pageTracks[soundtrackPage];dirty();renderSoundtrackManager(false)};
    async function uploadTracks(input,getList){
      const files=[...(input.files||[])];if(!files.length)return;
      try{
        for(const file of files){
          if(!String(file.type||'').startsWith('audio/'))throw new Error(file.name+' is not an audio file.');
          const rec=await uploadShared(file);mediaItems.unshift(rec);getList().push(cleanTrack(rec));
        }
        dirty();await renderSoundtrackManager(false);toast(files.length+' soundtrack file'+(files.length===1?'':'s')+' added — publish to save');
      }catch(e){alert(e?.message||String(e))}finally{input.value=''}
    }
    root.querySelector('#soundDefaultUpload').onchange=e=>uploadTracks(e.target,()=>ensureSoundtrackModel().defaultTracks);
    root.querySelector('#soundPageUpload').onchange=e=>uploadTracks(e.target,()=>ensureSoundtrackModel().pageTracks[soundtrackPage]??=([]));
    root.querySelector('#soundDefaultAddExisting').onclick=()=>{
      const index=Number(root.querySelector('#soundDefaultExisting').value);const rec=audioItems()[index];if(!rec)return;
      ensureSoundtrackModel().defaultTracks.push(cleanTrack(rec));dirty();renderSoundtrackManager(false);
    };
    root.querySelector('#soundPageAddExisting').onclick=()=>{
      const index=Number(root.querySelector('#soundPageExisting').value);const rec=audioItems()[index];if(!rec)return;
      const list=ensureSoundtrackModel().pageTracks[soundtrackPage]??=[];list.push(cleanTrack(rec));dirty();renderSoundtrackManager(false);
    };
    renderSoundtrackManager(false);
  }
  window.renderSoundtrackManager=()=>renderSoundtrackManager(false);
  mountSoundtrackManager();

  function bindGeneralUpload(id,field,kind){
    const input=document.getElementById(id);if(!input)return;
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{
      if(kind==='audio'&&!String(file.type||'').startsWith('audio/'))throw new Error('Choose an audio file.');
      if(kind==='image'&&!String(file.type||'').startsWith('image/'))throw new Error('Choose an image file.');
      const rec=await uploadShared(file);state.general[field]=rec.url;dirty();
      const bound=document.querySelector('[data-bind="general.'+field+'"]');if(bound)bound.value=rec.url;
      toast((field==='musicFile'?'Soundtrack':'Favorite photo')+' ready — publish to save');
      await renderLibrary();
    }catch(e){alert(e?.message||String(e))}finally{input.value=''}};
  }
   bindGeneralUpload('favoritePhotoUpload','favoritePhoto','image');
  renderLibrary();
})();