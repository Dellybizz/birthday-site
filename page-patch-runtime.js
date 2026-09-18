(()=>{
  const raw=location.pathname.split('/').filter(Boolean).pop()||'index.html';
  const adminPreview=new URLSearchParams(location.search).get('adminPreview')==='1';
  const PAGE=raw==='entry.html'?'index.html':(raw==='index.html'&&!adminPreview?'countdown.html':raw);
  const TRANSIENT=new Set(['visible','active','open','shown','show','entered','in-view','is-visible','revealed']);
  const GENERATED_SELECTOR=/(bday-added-media|bday-added-photo|data-bday-inserted|data-bday-group)/i;
  const EDITABLE_SELECTOR='a,button,img,video,audio,source,h1,h2,h3,h4,h5,h6,p,span,div,small,strong,em,li,section,article,svg,text,tspan';

  function cleanClasses(el){
    return [...(el.classList||[])].filter(c=>!TRANSIENT.has(c)&&!/^bday-/.test(c)).sort().slice(0,3);
  }
  function sourceSiblings(el){
    if(!el.parentElement)return [el];
    return [...el.parentElement.children].filter(n=>n.tagName===el.tagName&&!n.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]'));
  }
  function structuralKey(el){
    const bits=[];let n=el,guard=0;
    while(n&&n.nodeType===1&&n!==document.body&&guard++<8){
      const tag=n.tagName.toLowerCase();
      if(n.id){bits.unshift(tag+'#'+n.id);break}
      const cls=cleanClasses(n);
      const siblings=sourceSiblings(n);
      const idx=Math.max(1,siblings.indexOf(n)+1);
      bits.unshift(tag+(cls.length?'.'+cls.join('.'):'')+':'+idx);
      n=n.parentElement;
    }
    return bits.join('>');
  }
  function hash32(value){
    let h=2166136261;
    for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }
  function ensureEditIds(root=document){
    const nodes=root.querySelectorAll?.(EDITABLE_SELECTOR)||[];
    for(const el of nodes){
      if(el.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]'))continue;
      if(!el.dataset.editId)el.dataset.editId='be-'+hash32(PAGE+'|'+structuralKey(el));
    }
  }
  function stableSelector(selector){
    return String(selector||'').replace(/\.(?:visible|active|open|shown|show|entered|in-view|is-visible|revealed)\b/g,'').trim();
  }
  function candidateSelectors(selector){
    const original=String(selector||'').trim(),stable=stableSelector(original);
    return [...new Set([original,stable].filter(Boolean))];
  }
  function findTargets(selector){
    for(const candidate of candidateSelectors(selector)){
      try{const nodes=[...document.querySelectorAll(candidate)];if(nodes.length)return nodes}catch(e){}
    }
    return [];
  }
  function findTarget(selector){return findTargets(selector)[0]||null}
  function isGeneratedTarget(el){
    return !!el?.matches?.('.bday-added-media,.bday-added-photo,.bday-added-media-group,[data-bday-inserted],[data-bday-group]');
  }
  function isBroad(el){
    return !!el&&['HTML','BODY','MAIN','SECTION','ARTICLE'].includes(el.tagName);
  }
  function textEditable(el){
    if(!el||isGeneratedTarget(el)||isBroad(el))return false;
    if(['IMG','VIDEO','AUDIO','SOURCE','INPUT','TEXTAREA','SELECT','PICTURE','SVG'].includes(el.tagName))return false;
    if(['TEXT','TSPAN'].includes(el.tagName))return true;
    const children=[...el.children].filter(x=>x.tagName!=='BR');
    if(children.length)return false;
    return ['H1','H2','H3','H4','H5','H6','P','SPAN','DIV','SMALL','STRONG','EM','LI','A','BUTTON'].includes(el.tagName)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  }
  function mediaSlot(el){
    if(!el||isGeneratedTarget(el)||isBroad(el))return false;
    if(el.hasAttribute?.('data-media-slot'))return true;
    if(['IMG','VIDEO','AUDIO','SOURCE','PICTURE'].includes(el.tagName))return true;
    const signature=((el.id||'')+' '+(typeof el.className==='string'?el.className:'')).toLowerCase();
    return /(^|[\s_-])(photo|image|media|polaroid|poster|picture|pic|frame|shot|avatar|placeholder|thumb)([\s_-]|$)/.test(signature);
  }
  async function readLive(){
    try{if(window.BDAY){const r=await (window.BDAY.ready||window.BDAY.load?.()||window.BDAY.fetchRemote());if(r?.state)return r.state}}catch(e){}
    try{if(window.BDAY?.read)return window.BDAY.read()}catch(e){}
    return window.SITE_CONFIG||{};
  }
  function mediaKind(item){
    const t=String(item?.type||'').toLowerCase(),u=String(item?.url||'').toLowerCase().split('?')[0];
    if(t.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/.test(u))return 'video';
    if(t.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(u))return 'audio';
    return 'image';
  }
  function mediaNode(item){
    const kind=mediaKind(item);let el;
    if(kind==='video'){el=document.createElement('video');el.controls=true;el.playsInline=true;el.preload='metadata'}
    else if(kind==='audio'){el=document.createElement('audio');el.controls=true;el.preload='metadata'}
    else{el=document.createElement('img');el.alt=item?.alt||item?.name||'';el.loading='lazy';el.decoding='async'}
    el.src=item.url;el.className='bday-added-media';el.dataset.bdayInserted=item.id||item.url;return el;
  }
  function safeAttr(value){return String(value||'').replace(/["\\]/g,'')}
  function insertedNode(item,root=document){
    const token=safeAttr(item?.id||item?.url);if(!token)return null;
    try{return root.querySelector?.('[data-bday-inserted="'+token+'"]')||null}catch(e){return null}
  }
  function prepareReplaceSlot(anchor){
    if(!anchor||isBroad(anchor)||isGeneratedTarget(anchor))return false;
    if(anchor.dataset.bdayMediaReplaced==='1')return true;
    const holder=document.createElement('span');
    holder.className='bday-original-slot-content';
    holder.dataset.bdayOriginalSlot='1';
    while(anchor.firstChild)holder.appendChild(anchor.firstChild);
    holder.hidden=true;
    anchor.appendChild(holder);
    anchor.dataset.bdayMediaReplaced='1';
    return true;
  }
  function restoreReplaceSlot(anchor){
    if(!anchor||anchor.dataset.bdayMediaReplaced!=='1')return;
    const holder=[...anchor.children].find(x=>x.dataset?.bdayOriginalSlot==='1');
    if(holder){
      while(holder.firstChild)anchor.insertBefore(holder.firstChild,holder);
      holder.remove();
    }
    delete anchor.dataset.bdayMediaReplaced;
  }
  function groupFor(anchor,placement,key){
    if(!anchor?.parentNode)return null;
    const marker='bday-'+placement+'-'+key;
    let group=[...anchor.parentNode.children].find(x=>x.dataset?.bdayGroup===marker);
    if(group)return group;
    group=document.createElement('div');group.className='bday-added-media-group';group.dataset.bdayGroup=marker;
    if(placement==='before')anchor.parentNode.insertBefore(group,anchor);
    else anchor.parentNode.insertBefore(group,anchor.nextSibling);
    return group;
  }
  function insertOne(anchor,item,patchKey){
    if(!anchor||!item?.url||isBroad(anchor)||isGeneratedTarget(anchor))return;
    const placement=item.placement||'inside';
    const scope=(placement==='replace'||placement==='inside')?anchor:(anchor.parentElement||document);
    const existing=insertedNode(item,scope);
    if(existing){
      if(existing.getAttribute('src')!==item.url){existing.setAttribute('src',item.url);if('src' in existing)existing.src=item.url;existing.load?.()}
      return;
    }
    if(anchor.matches?.('img,video,audio,source')){
      if(!anchor.dataset.bdayOriginalSrc)anchor.dataset.bdayOriginalSrc=anchor.getAttribute('src')||'';
      anchor.setAttribute('src',item.url);if('src' in anchor)anchor.src=item.url;anchor.dataset.bdayInserted=item.id||item.url;anchor.load?.();return;
    }
    if(!mediaSlot(anchor))return;
    const el=mediaNode(item);
    if(placement==='replace'){
      if(!prepareReplaceSlot(anchor))return;
      anchor.querySelectorAll(':scope > .bday-added-media').forEach(n=>n.remove());
      anchor.appendChild(el);
    }else if(placement==='before'||placement==='after'){
      groupFor(anchor,placement,patchKey)?.appendChild(el);
    }else anchor.appendChild(el);
  }
  function applyPatch(anchor,patch,patchIndex){
    if(!anchor||isGeneratedTarget(anchor))return;
    if(patch.hidden){
      if(adminPreview){anchor.style.removeProperty('display');anchor.style.setProperty('outline','2px dashed #ff7f7f');anchor.style.setProperty('outline-offset','2px');anchor.dataset.bdayHiddenPreview='1'}
      else anchor.style.setProperty('display','none','important');
    }else if(adminPreview&&anchor.dataset.bdayHiddenPreview==='1'){
      anchor.style.removeProperty('outline');anchor.style.removeProperty('outline-offset');delete anchor.dataset.bdayHiddenPreview;
    }
    if(patch.src&&anchor.matches?.('img,video,audio,source')){
      if(!anchor.dataset.bdayOriginalSrc)anchor.dataset.bdayOriginalSrc=anchor.getAttribute('src')||'';
      anchor.setAttribute('src',patch.src);if('src' in anchor)anchor.src=patch.src;anchor.load?.();
    }
    if(patch.text!==undefined&&patch.text!==null&&textEditable(anchor))anchor.textContent=String(patch.text);
    if(patch.href&&anchor.matches?.('a')&&!anchor.matches?.('[data-journey-next],[data-journey-restart]'))anchor.setAttribute('href',patch.href);
    if(patch.styles&&typeof patch.styles==='object'){
      for(const [name,value] of Object.entries(patch.styles))if(value!==undefined&&value!==null&&value!=='')anchor.style.setProperty(name,String(value));
    }
    const inserted=Array.isArray(patch.insertImages)?patch.insertImages:Array.isArray(patch.insertMedia)?patch.insertMedia:[];
    if(inserted.length&&mediaSlot(anchor))inserted.forEach((item,index)=>insertOne(anchor,item,patchIndex+'-'+index));
  }


  let cachedState=null;
  async function applyAll(forceRead=false){
    ensureEditIds(document);
    if(forceRead||!cachedState)cachedState=await readLive();
    const patches=cachedState?.patches?.[PAGE]||[];
    patches.forEach((patch,index)=>{
      if(!patch?.selector||GENERATED_SELECTOR.test(patch.selector))return;
      const anchors=findTargets(patch.selector);anchors.forEach((anchor,targetIndex)=>applyPatch(anchor,patch,index+'-'+targetIndex));
    });
  }

  const style=document.createElement('style');
  style.textContent='[data-media-slot] > .bday-added-media{width:100%;height:100%;max-width:none;margin:0;border-radius:inherit;object-fit:cover}.bday-added-media-group{display:grid;gap:14px;margin:16px 0}.bday-added-media{display:block;max-width:min(100%,680px);width:auto;height:auto;margin:0 auto;border-radius:18px;object-fit:cover}.bday-added-media-group>audio,.bday-added-media-group>video{width:min(100%,680px)}.bday-original-slot-content[hidden]{display:none!important}.node .bday-added-media{width:100%;height:100%;max-width:none;margin:0;border-radius:0;object-fit:cover}';
  document.head.appendChild(style);
  window.BDAY_PATCH_RUNTIME={ensureEditIds,findTarget,findTargets,mediaSlot,textEditable,restoreReplaceSlot,applyAll:()=>applyAll(true)};
  [20,220,800,1800].forEach((delay,index)=>setTimeout(()=>applyAll(index===0),delay));
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node?.nodeType!==1)continue;
        if(node.matches?.(EDITABLE_SELECTOR)&&!isGeneratedTarget(node)&&!node.dataset.editId){
          node.dataset.editId='be-'+hash32(PAGE+'|'+structuralKey(node));
        }
        ensureEditIds(node);
      }
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(()=>observer.disconnect(),6000);
})();