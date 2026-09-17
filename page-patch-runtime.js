(()=>{
  const raw=location.pathname.split('/').filter(Boolean).pop()||'index.html';
  const adminPreview=new URLSearchParams(location.search).get('adminPreview')==='1';
  let PAGE=raw;
  if(PAGE==='entry.html')PAGE='index.html';
  else if(PAGE==='index.html'&&!adminPreview)PAGE='countdown.html';

  const TRANSIENT=/\.(?:visible|active|open|shown|show|entered|in-view|is-visible|revealed)\b/g;
  const mediaClass='bday-added-media';

  function stableSelector(selector){
    return String(selector||'').replace(TRANSIENT,'');
  }

  function candidateSelectors(selector){
    const original=String(selector||'').trim();
    const stable=stableSelector(original).trim();
    const relaxed=stable.replace(/:nth-of-type\(\d+\)/g,'');
    return [...new Set([original,stable,relaxed].filter(Boolean))];
  }

  function findTarget(selector){
    for(const candidate of candidateSelectors(selector)){
      try{const el=document.querySelector(candidate);if(el)return el}catch(e){}
    }
    return null;
  }

  async function readLive(){
    try{
      if(window.BDAY?.fetchRemote){
        const result=await window.BDAY.fetchRemote();
        if(result?.state)return result.state;
      }
    }catch(e){}
    try{if(window.BDAY?.read)return window.BDAY.read()}catch(e){}
    return window.SITE_CONFIG||{};
  }

  function mimeFromItem(item){
    if(item?.type)return String(item.type).toLowerCase();
    const url=String(item?.url||'').toLowerCase().split('?')[0];
    if(/\.(mp4|webm|mov|m4v)$/.test(url))return 'video/unknown';
    if(/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(url))return 'audio/unknown';
    return 'image/unknown';
  }

  function mediaNode(item){
    const type=mimeFromItem(item);
    let el;
    if(type.startsWith('video/')){
      el=document.createElement('video');
      el.controls=true;el.playsInline=true;el.preload='metadata';
    }else if(type.startsWith('audio/')){
      el=document.createElement('audio');
      el.controls=true;el.preload='metadata';
    }else{
      el=document.createElement('img');
      el.alt=item?.alt||item?.name||'';el.loading='lazy';el.decoding='async';
    }
    el.src=item.url;
    el.className=mediaClass;
    el.dataset.bdayInserted=item.id||item.url;
    return el;
  }

  function safeDuplicateId(value){
    return String(value||'').replace(/["\\]/g,'');
  }

  function alreadyInserted(item){
    const id=safeDuplicateId(item?.id||item?.url);
    if(!id)return false;
    return !!document.querySelector('[data-bday-inserted="'+id+'"]');
  }

  function groupFor(anchor,placement,key){
    const parent=anchor.parentNode;
    if(!parent)return null;
    const marker='bday-'+placement+'-'+key;
    let group=parent.querySelector?.('[data-bday-group="'+marker.replace(/["\\]/g,'')+'"]');
    if(group)return group;
    group=document.createElement('div');
    group.className='bday-added-media-group';
    group.dataset.bdayGroup=marker;
    if(placement==='before')parent.insertBefore(group,anchor);
    else parent.insertBefore(group,anchor.nextSibling);
    return group;
  }

  function insertOne(anchor,item,patchKey){
    if(!anchor||!item?.url||alreadyInserted(item))return;
    const el=mediaNode(item);
    const placement=item.placement||'inside';
    if(placement==='replace'){
      if(anchor.matches?.('img,video,audio,source')){
        anchor.setAttribute('src',item.url);
        if('src' in anchor)anchor.src=item.url;
        anchor.dataset.bdayInserted=item.id||item.url;
        if(anchor.tagName==='VIDEO'||anchor.tagName==='AUDIO')anchor.load?.();
      }else{
        if(anchor.dataset.bdayMediaReplaced!=='1'){
          anchor.innerHTML='';
          anchor.dataset.bdayMediaReplaced='1';
        }
        anchor.appendChild(el);
      }
    }else if(placement==='before'||placement==='after'){
      const group=groupFor(anchor,placement,patchKey);
      group?.appendChild(el);
    }else{
      anchor.appendChild(el);
    }
  }

  function applyPatch(anchor,patch,patchIndex){
    if(!anchor)return;
    if(patch.hidden){if(adminPreview){anchor.style.removeProperty('display');anchor.style.setProperty('outline','2px dashed #ff7f7f');anchor.style.setProperty('outline-offset','2px');anchor.dataset.bdayHiddenPreview='1'}else anchor.style.setProperty('display','none','important')}else if(adminPreview&&anchor.dataset.bdayHiddenPreview==='1'){anchor.style.removeProperty('outline');anchor.style.removeProperty('outline-offset');delete anchor.dataset.bdayHiddenPreview}
    if(patch.src&&anchor.matches?.('img,video,audio,source')){
      anchor.setAttribute('src',patch.src);
      if('src' in anchor)anchor.src=patch.src;
      if(anchor.tagName==='VIDEO'||anchor.tagName==='AUDIO')anchor.load?.();
    }
    if(patch.text!==undefined&&patch.text!==null&&!anchor.matches?.('img,video,audio,source,input,textarea,select'))anchor.textContent=String(patch.text);
    if(patch.href&&anchor.matches?.('a'))anchor.setAttribute('href',patch.href);
    if(patch.styles&&typeof patch.styles==='object'){
      for(const [name,value] of Object.entries(patch.styles)){
        if(value!==undefined&&value!==null&&value!=='')anchor.style.setProperty(name,String(value));
      }
    }
    const inserted=Array.isArray(patch.insertImages)?patch.insertImages:Array.isArray(patch.insertMedia)?patch.insertMedia:[];
    inserted.forEach((item,index)=>insertOne(anchor,item,patchIndex+'-'+index));
  }

  function heartMediaType(el){
    if(!el)return 'image';
    const tag=String(el.tagName||'').toLowerCase();
    if(tag==='video')return 'video';
    if(tag==='audio')return 'audio';
    const src=String(el.currentSrc||el.getAttribute?.('src')||el.src||'').toLowerCase().split('?')[0];
    if(/\.(mp4|webm|mov|m4v)$/.test(src))return 'video';
    if(/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(src))return 'audio';
    return 'image';
  }

  function syncHeartCard(index,card){
    if(PAGE!=='heart.html'||!card)return;
    try{
      if(typeof MEMORIES==='undefined'||!Array.isArray(MEMORIES)||!MEMORIES[index])return;
      const media=card.querySelector('video[src],img[src],audio[src]');
      if(!media)return;
      const src=media.currentSrc||media.getAttribute('src')||media.src||'';
      if(!src)return;
      MEMORIES[index].src=src;
      MEMORIES[index].type=heartMediaType(media);
      card.dataset.heartMediaSrc=src;
      card.dataset.heartMediaType=MEMORIES[index].type;
    }catch(e){}
  }

  function syncHeartCards(){
    if(PAGE!=='heart.html')return;
    try{
      [...document.querySelectorAll('#nodeLayer .node')].forEach((card,index)=>syncHeartCard(index,card));
    }catch(e){}
  }

  function installHeartCardMediaBridge(){
    if(PAGE!=='heart.html'||window.__heartCardMediaBridge)return;
    window.__heartCardMediaBridge=true;

    document.addEventListener('click',e=>{
      const card=e.target?.closest?.('#nodeLayer .node');
      if(!card)return;
      const cards=[...document.querySelectorAll('#nodeLayer .node')];
      const index=cards.indexOf(card);
      if(index>=0)syncHeartCard(index,card);
    },true);

    try{
      if(typeof openPopup==='function'){
        const nativeOpenPopup=openPopup;
        openPopup=function(index){
          const cards=[...document.querySelectorAll('#nodeLayer .node')];
          const normalized=((index%cards.length)+cards.length)%cards.length;
          if(cards[normalized])syncHeartCard(normalized,cards[normalized]);

          try{
            const item=(typeof MEMORIES!=='undefined'&&MEMORIES[normalized])?MEMORIES[normalized]:null;
            if(item?.type==='audio'&&item?.src){
              popupIndex=normalized;
              popupMedia.innerHTML='';
              const audio=document.createElement('audio');
              audio.src=item.src;audio.controls=true;audio.autoplay=true;audio.preload='metadata';
              popupMedia.appendChild(audio);
              popupTitle.textContent=item.title;
              popupNote.textContent=item.note;
              popupType.textContent='audio · '+String(normalized+1).padStart(2,'0')+'/'+MEMORIES.length;
              popup.classList.add('show');
              stage.classList.add('popup-open');
              return;
            }
          }catch(e){}
          return nativeOpenPopup(index);
        };
      }
    }catch(e){}
  }

  let cachedState=null;
  async function applyAll(forceRead=false){
    if(forceRead||!cachedState)cachedState=await readLive();
    const patches=cachedState?.patches?.[PAGE]||[];
    patches.forEach((patch,index)=>{
      if(!patch?.selector)return;
      const anchor=findTarget(patch.selector);
      if(anchor)applyPatch(anchor,patch,index);
    });
    syncHeartCards();
    installHeartCardMediaBridge();
  }

  const style=document.createElement('style');
  style.textContent='.bday-added-media-group{display:grid;gap:14px;margin:16px 0}.bday-added-media{display:block;max-width:min(100%,680px);width:auto;height:auto;margin:0 auto;border-radius:18px;object-fit:cover}.bday-added-media-group>audio,.bday-added-media-group>video{width:min(100%,680px)}.node .placeholder:has(.bday-added-media){padding:0}.node .bday-added-media{width:100%;height:100%;max-width:none;margin:0;border-radius:0;object-fit:cover}';
  document.head.appendChild(style);

  [40,250,800,1800].forEach((delay,index)=>setTimeout(()=>applyAll(index===0),delay));
  const observer=new MutationObserver(()=>applyAll(false));
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  setTimeout(()=>observer.disconnect(),7000);
})();
