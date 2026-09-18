(()=>{
  const VERSION='20260918-p10';
  window.__BDAY_ASSET_VERSION__=VERSION;
  const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function syncMotion(){
    const reduced=!!motionQuery?.matches;
    window.__birthdayReducedMotion=reduced;
    document.documentElement.classList.toggle('birthday-reduced-motion',reduced);
  }
  syncMotion();
  motionQuery?.addEventListener?.('change',syncMotion);

  const style=document.createElement('style');
  style.id='birthday-phase10-runtime';
  style.textContent=`
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
img,video{max-width:100%}
button,input,select,textarea{font:inherit}
@media(max-width:430px){
  button,input,select,textarea,.btn,[role="button"],a.next,.one-more,.end-actions a,.end-actions button{min-height:44px}
  .lock-card,.photo-lightbox-card,.corner-popup,.popup,.modal,.dialog{max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - 24px)!important;overflow:auto}
  .end-actions{width:calc(100vw - 24px);max-width:520px;flex-wrap:wrap;justify-content:center;bottom:max(12px,env(safe-area-inset-bottom))}
  .end-actions>*{flex:1 1 140px;text-align:center}
  .bday-lock-wrap{padding-left:10px;padding-right:10px}
  .controls button{min-width:44px;min-height:44px}
  .stall-view{max-width:calc(100vw - 12px)!important}
  .stall-actions{max-width:calc(100vw - 24px);width:100%}
  .photo-lightbox-card img{max-height:68dvh;object-fit:contain!important}
}
@media(max-width:390px){
  .photo-lightbox-card{width:calc(100vw - 20px)!important}
  .lock-card{padding:20px!important}
}
@media(max-width:360px){
  button,input,select,textarea,.btn,[role="button"],a.next{min-height:46px}
  .end-actions{gap:8px}
}
@media(prefers-reduced-motion:reduce){
  html:focus-within{scroll-behavior:auto!important}
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
`;
  document.head.appendChild(style);

  const setText=(id,value)=>{const el=document.getElementById(id);if(el&&value!==undefined&&value!==null)el.textContent=String(value)};

  function applyRuntimeCss(state){
    const raw=location.pathname.split('/').filter(Boolean).pop()||'index.html';
    const page=raw==='entry.html'?'index.html':raw;
    const css=[state?.general?.globalCss||'',state?.pageCss?.[page]||''].filter(Boolean).join('\n');
    let node=document.getElementById('birthday-runtime-css');
    if(css){
      if(!node){node=document.createElement('style');node.id='birthday-runtime-css';document.head.appendChild(node)}
      node.textContent=css;
    }else node?.remove();
  }

  function applyEntry(state){
    if(!location.pathname.endsWith('/entry.html'))return;
    const g=state.general||{},p=state.pages?.entry||{};
    try{
      if(typeof CONFIG!=='undefined'){
        Object.assign(CONFIG,p);
        CONFIG.name=g.name||CONFIG.name;
        CONFIG.nickname=g.nickname||CONFIG.nickname;
        CONFIG.insideJoke=g.insideJoke||CONFIG.insideJoke;
        CONFIG.introLine=g.introLine||CONFIG.introLine;
        const delivery=document.getElementById('deliveryText');
        if(delivery)delivery.innerHTML='If your name is <strong>'+String(CONFIG.name)+'</strong>, you may continue. Everyone else, please leave politely.';
        setText('heyLine','hey, '+CONFIG.nickname+'…');
        setText('bigName',CONFIG.name);
        setText('letterName',CONFIG.nickname);
        setText('insideJoke',CONFIG.insideJoke);
        setText('personalLine',CONFIG.introLine);
      }
    }catch(e){}
  }

  function applyMemories(state){
    if(!location.pathname.endsWith('/memories.html'))return;
    const g=state.general||{};
    try{
      if(typeof CONFIG!=='undefined'){
        Object.assign(CONFIG,state.pages?.memories||{});
        CONFIG.name=g.name||CONFIG.name;
        CONFIG.nickname=g.nickname||CONFIG.nickname;
        setText('privateLine','for '+CONFIG.nickname+', obviously.');
        setText('heroText',CONFIG.heroText);setText('heroPS',CONFIG.heroPS);
        setText('m1Title',CONFIG.memory1?.title);setText('m1Meta',CONFIG.memory1?.meta);setText('m1Caption',CONFIG.memory1?.caption);setText('m1Note',CONFIG.memory1?.note);setText('tag1',CONFIG.memory1?.tag);setText('scribble1',CONFIG.memory1?.scribble);
        setText('tinyMemory','“'+(CONFIG.tinyMemory||'')+'”');setText('tinyMemoryNote',CONFIG.tinyMemoryNote);
        setText('chatTitle',CONFIG.chat?.title);setText('chatCaption',CONFIG.chat?.caption);setText('chatAside',CONFIG.chat?.aside);setText('chatName',CONFIG.name);setText('chatStatus',CONFIG.chat?.status);setText('msg1',CONFIG.chat?.her1);setText('msg2',CONFIG.chat?.me1);setText('msg3',CONFIG.chat?.her2);
        setText('bridge1',CONFIG.bridge1);setText('bridge1Sub',CONFIG.bridge1Sub);
        setText('m2Title',CONFIG.memory2?.title);setText('m2Caption',CONFIG.memory2?.caption);setText('m2Note',CONFIG.memory2?.note);setText('tag2',CONFIG.memory2?.tag);setText('scribble2',CONFIG.memory2?.scribble);
        setText('collageTitle',CONFIG.collageTitle);setText('collageCaption',CONFIG.collageCaption);
        setText('favoritePersonLine','“'+(CONFIG.favoritePersonLine||'')+'”');setText('favoritePersonSub',CONFIG.favoritePersonSub);
        setText('m3Title',CONFIG.memory3?.title);setText('m3Caption',CONFIG.memory3?.caption);setText('m3Note',CONFIG.memory3?.note);setText('tag3',CONFIG.memory3?.tag);setText('scribble3',CONFIG.memory3?.scribble);
        setText('finalMemoryLine','“'+(CONFIG.finalMemoryLine||'')+'”');setText('finalMemorySub',CONFIG.finalMemorySub);setText('finalSecret',CONFIG.finalSecret);
        setText('endingTitle',CONFIG.endingTitle);setText('endingText',CONFIG.endingText);
      }
    }catch(e){}
  }

  function applyPretty(state){
    if(!location.pathname.endsWith('/pretty-photos.html'))return;
    const g=state.general||{};
    try{
      if(typeof CONFIG!=='undefined'){
        Object.assign(CONFIG,state.pages?.pretty||{});
        CONFIG.nickname=g.nickname||CONFIG.nickname;
        setText('nickname',CONFIG.nickname);setText('heroSub',CONFIG.heroSub);setText('scribbleOne',CONFIG.scribbleOne);setText('scribbleTwo',CONFIG.scribbleTwo);setText('spreadText',CONFIG.spreadText);setText('handNote',CONFIG.handNote);
        const q1=document.getElementById('quoteText');if(q1)q1.innerHTML=String(CONFIG.quoteText||'').replace('weren’t even trying','<span>weren’t even trying</span>');
        setText('quoteSub',CONFIG.quoteSub);
        const solo=document.getElementById('soloTitle');if(solo)solo.innerHTML=String(CONFIG.soloTitle||'').replace('. ','.<br>');
        setText('soloCopy',CONFIG.soloCopy);
        const q2=document.getElementById('quoteTwo');if(q2){const raw=String(CONFIG.quoteTwo||''),parts=raw.split('you’re very pretty.');q2.innerHTML=parts.length>1?parts[0]+'<span>you’re very pretty.</span>':raw}
        setText('quoteTwoSub',CONFIG.quoteTwoSub);
      }
    }catch(e){}
  }

  function applyHeart(state){
    if(!location.pathname.endsWith('/heart.html'))return;
    const memories=state.pages?.heart?.memories;
    if(!Array.isArray(memories)||!window.HEART_MEMORY_APP?.updateMemory)return;
    memories.slice(0,20).forEach((record,index)=>window.HEART_MEMORY_APP.updateMemory(index,record));
  }

  function applyYapping(state){
    if(!location.pathname.endsWith('/yapping.html'))return;
    const clips=state.pages?.yapping?.clips;
    if(!Array.isArray(clips)||!window.YAPPING_ARCHIVE?.updateClip)return;
    clips.slice(0,5).forEach((record,index)=>window.YAPPING_ARCHIVE.updateClip(index,record));
  }

  function applyFair(state){
    if(!location.pathname.endsWith('/fair.html'))return;
    try{
      if(typeof ITEMS==='undefined'||typeof PHOTO_LIBRARY==='undefined')return;
      const itemState=state.fairItems||{},photoState=state.fairPhotos||{};
      if(typeof FAIR_DEFAULT_ITEMS!=='undefined'){
        for(const id of Object.keys(ITEMS))Object.assign(ITEMS[id],FAIR_DEFAULT_ITEMS[id]||{},itemState[id]||{});
      }else for(const id of Object.keys(itemState))if(ITEMS[id])Object.assign(ITEMS[id],itemState[id]||{});
      if(typeof FAIR_DEFAULT_PHOTOS!=='undefined'){
        for(const id of Object.keys(PHOTO_LIBRARY)){
          PHOTO_LIBRARY[id]=JSON.parse(JSON.stringify(FAIR_DEFAULT_PHOTOS[id]));
          const o=photoState[id]||{};
          if(o.hero)PHOTO_LIBRARY[id].hero=o.hero;
          PHOTO_LIBRARY[id].photos=PHOTO_LIBRARY[id].photos||[];
          for(let i=0;i<6;i++){
            if(o['photo'+i]){PHOTO_LIBRARY[id].photos[i]=PHOTO_LIBRARY[id].photos[i]||{};PHOTO_LIBRARY[id].photos[i].src=o['photo'+i]}
            if(o['caption'+i]){PHOTO_LIBRARY[id].photos[i]=PHOTO_LIBRARY[id].photos[i]||{};PHOTO_LIBRARY[id].photos[i].caption=o['caption'+i]}
          }
        }
      }
      if(typeof overlay!=='undefined'&&overlay?.classList?.contains('show')&&typeof fillStall==='function')fillStall(currentItemId||'smile');
    }catch(e){}
  }

  function applyFinale(state){
    if(!location.pathname.endsWith('/finale.html'))return;
    const g=state.general||{};
    try{
      if(typeof CONFIG!=='undefined'){
        Object.assign(CONFIG,state.pages?.finale||{});
        CONFIG.nickname=g.nickname||CONFIG.nickname;
        CONFIG.favoritePhoto=typeof g.favoritePhoto==='string'?g.favoritePhoto:CONFIG.favoritePhoto;
        const frame=document.getElementById('photoFrame');
        if(frame){
          if(CONFIG.favoritePhoto)frame.innerHTML='<img src="'+CONFIG.favoritePhoto.replace(/"/g,'&quot;')+'" alt="">';
          else frame.innerHTML='<div class="photo-placeholder">replace with your favourite photo of her</div>';
        }
        setText('birthdayLine','happy birthday, '+CONFIG.nickname+'. ♡');
      }
    }catch(e){}
  }

  function applyCountdown(state){
    if(!location.pathname.endsWith('/countdown.html'))return;
    const g=state.general||{};
    try{
      if(typeof target!=='undefined'){
        const parsed=new Date(g.birthdayISO||'');
        if(!Number.isNaN(parsed.getTime())){
          target=parsed;
          if(typeof previewMode!=='undefined')previewMode=false;
          const preview=document.getElementById('preview');if(preview)preview.textContent='';
          if(Date.now()<target.getTime()){
            document.getElementById('stage')?.classList.remove('arrived');
            document.getElementById('next')?.classList.remove('show');
          }
        }
      }
    }catch(e){}
  }

  function applyState(state){
    if(!state||typeof state!=='object')return;
    applyRuntimeCss(state);
    applyEntry(state);
    applyMemories(state);
    applyPretty(state);
    applyHeart(state);
    applyYapping(state);
    applyFair(state);
    applyFinale(state);
    applyCountdown(state);
  }

  function whenDom(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else queueMicrotask(fn);
  }

  const B=window.BDAY;
  if(B){
    whenDom(()=>applyState(B.read?.()||{}));
    const ready=B.ready||B.load?.();
    if(ready)Promise.resolve(ready).then(result=>whenDom(()=>applyState(result?.state||B.read?.()||{}))).catch(()=>{});
  }
  window.addEventListener('birthday:state',event=>whenDom(()=>applyState(event.detail?.state||{})));
})();