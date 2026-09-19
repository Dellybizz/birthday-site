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
  function countdownManagedText(el){
    if(PAGE!=='countdown.html'||!el)return false;
    const owner=el.id?el:el.closest?.('[id]');
    const id=owner?.id||'';
    return ['eyebrow','title','sub','lockLabel','lockNote','lockDialogTitle','lockDialogText'].includes(id);
  }

  function mediaSlot(el){
    if(!el||isGeneratedTarget(el)||isBroad(el))return false;
    if(el.hasAttribute?.('data-media-slot'))return true;
    if(['IMG','VIDEO','AUDIO','SOURCE','PICTURE'].includes(el.tagName))return true;
    const signature=((el.id||'')+' '+(typeof el.className==='string'?el.className:'')).toLowerCase();
    return /(^|[\s_-])(photo|image|media|polaroid|poster|picture|pic|frame|shot|avatar|placeholder|thumb)([\s_-]|$)/.test(signature);
  }
  async function readLive(){
    try{if(window.BDAY){const ready=window.BDAY.ready||window.BDAY.load?.();if(ready){const r=await ready;if(r?.state)return r.state}}}catch(e){}
    try{if(window.BDAY?.read)return window.BDAY.read()}catch(e){}
    return window.SITE_CONFIG||{};
  }
  function mediaKind(item){
    const t=String(item?.type||'').toLowerCase(),u=String(item?.url||'').toLowerCase().split('?')[0];
    if(t.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/.test(u))return 'video';
    if(t.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(u))return 'audio';
    return 'image';
  }
  const MEDIA_FRAME_SELECTOR='.photo,.tile,.node,.player,.photo-frame,.popup-media,.polaroid,.image-frame,.media-frame,[data-media-frame]';
  function mediaFrameFor(el,anchor){
    if(!el)return anchor||null;
    if(PAGE==='memories.html'){
      const memorySlot=el.closest?.('[data-media-slot^="memories-"]')||anchor?.closest?.('[data-media-slot^="memories-"]')||null;
      const memoryFrame=memorySlot?.closest?.('.photo');
      if(memoryFrame)return memoryFrame;
    }
    const framed=el.closest?.(MEDIA_FRAME_SELECTOR);
    if(framed&&framed!==el)return framed;
    const slot=el.closest?.('[data-media-slot]')||anchor?.closest?.('[data-media-slot]')||null;
    if(slot){
      const parent=slot.parentElement;
      if(parent){
        const s=parent.ownerDocument.defaultView.getComputedStyle(parent);
        if(s.overflow==='hidden'||s.overflowX==='hidden'||s.overflowY==='hidden'||s.aspectRatio!=='auto')return parent;
      }
      return slot;
    }
    return anchor||el.parentElement||el;
  }
  function isPrettyStripFrame(frame){
    return PAGE==='pretty-photos.html'&&!!frame?.matches?.('.strip-card');
  }
  function prettyStripBaseWidth(frame){
    if(!isPrettyStripFrame(frame))return 0;
    const cached=Number(frame.dataset?.bdayPrettyBaseWidth);
    if(Number.isFinite(cached)&&cached>0)return cached;
    const rendered=frame.getBoundingClientRect().width;
    if(!Number.isFinite(rendered)||rendered<=0)return 0;
    frame.dataset.bdayPrettyBaseWidth=String(rendered);
    return rendered;
  }
  function applyMediaPresentation(el,item){
    if(!el||!item||el.tagName==='AUDIO')return;
    const x=Number.isFinite(Number(item.positionX))?Math.max(0,Math.min(100,Number(item.positionX))):50;
    const y=Number.isFinite(Number(item.positionY))?Math.max(0,Math.min(100,Number(item.positionY))):50;
    const fallback=String(item.position||'center center');
    el.style.setProperty('object-fit',item.fit||'cover','important');
    el.style.setProperty('object-position',(item.positionX!==undefined||item.positionY!==undefined)?(x+'% '+y+'%'):fallback,'important');
  }
  function applyMemoriesFrameWidth(frame,width){
    const beat=frame?.closest?.('article.beat'),inner=frame?.closest?.('.beat-inner'),visual=frame?.closest?.('.visual');
    if(!beat||!inner||!visual)return false;
    const scale=Math.max(25,Math.min(140,Number(width)||100))/100;
    if(frame.ownerDocument.defaultView.matchMedia('(max-width:760px)').matches){
      inner.style.removeProperty('grid-template-columns');
      visual.style.setProperty('width',Math.min(100,Math.max(25,Number(width)||100))+'%','important');
      visual.style.setProperty('margin-left','auto','important');
      visual.style.setProperty('margin-right','auto','important');
    }else{
      visual.style.setProperty('width','100%','important');
      visual.style.removeProperty('margin-left');visual.style.removeProperty('margin-right');
      const reverse=beat.classList.contains('reverse'),baseVisual=reverse?44:56;
      const visualShare=Math.max(24,Math.min(76,baseVisual*scale)),copyShare=100-visualShare;
      const visualFr=(visualShare/50).toFixed(3),copyFr=(copyShare/50).toFixed(3);
      inner.style.setProperty('grid-template-columns',
        reverse?'minmax(280px,'+copyFr+'fr) minmax(0,'+visualFr+'fr)':'minmax(0,'+visualFr+'fr) minmax(280px,'+copyFr+'fr)',
        'important');
    }
    frame.style.setProperty('width','100%','important');
    frame.style.setProperty('max-width','none','important');
    frame.style.setProperty('margin-left','auto','important');
    frame.style.setProperty('margin-right','auto','important');
    return true;
  }
  function applyMediaFrame(el,item,anchor){
    if(!el||!item)return;
    const frame=mediaFrameFor(el,anchor);if(!frame)return;
    const width=Number(item.frameWidth),height=Number(item.frameHeight);
    const memoriesFrame=PAGE==='memories.html'&&frame.matches?.('.photo')&&Number.isFinite(width)&&width>0&&applyMemoriesFrameWidth(frame,width);
    if(!memoriesFrame&&isPrettyStripFrame(frame)&&Number.isFinite(width)&&width>0){
      const scale=Math.max(25,Math.min(140,width));
      const base=prettyStripBaseWidth(frame);
      if(Math.abs(scale-100)<.001){
        frame.style.removeProperty('width');
        frame.style.removeProperty('max-width');
        frame.style.removeProperty('margin-left');
        frame.style.removeProperty('margin-right');
      }else if(base>0){
        frame.style.setProperty('width',(base*scale/100)+'px','important');
        frame.style.removeProperty('max-width');
        frame.style.removeProperty('margin-left');
        frame.style.removeProperty('margin-right');
      }
    }else if(!memoriesFrame&&Number.isFinite(width)&&width>0){
      frame.style.setProperty('width',Math.max(25,Math.min(140,width))+'%','important');
      frame.style.setProperty('max-width','none','important');
      frame.style.setProperty('margin-left','auto','important');
      frame.style.setProperty('margin-right','auto','important');
    }
    if(Number.isFinite(height)&&height>0){
      frame.style.setProperty('height',Math.max(40,Math.min(1200,height))+'px','important');
      frame.style.setProperty('min-height','0','important');
      frame.style.setProperty('aspect-ratio','auto','important');
    }else{
      frame.style.removeProperty('height');
      frame.style.removeProperty('min-height');
      frame.style.removeProperty('aspect-ratio');
    }
  }
  function mediaNode(item){
    const kind=mediaKind(item);let el;
    if(kind==='video'){el=document.createElement('video');el.controls=true;el.playsInline=true;el.preload='metadata'}
    else if(kind==='audio'){el=document.createElement('audio');el.controls=true;el.preload='metadata'}
    else{el=document.createElement('img');el.alt=item?.alt||item?.name||'';el.loading='lazy';el.decoding='async'}
    el.src=item.url;el.className='bday-added-media';el.dataset.bdayInserted=item.id||item.url;applyMediaPresentation(el,item);return el;
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
      applyMediaPresentation(existing,item);applyMediaFrame(existing,item,anchor);
      return;
    }
    if(anchor.matches?.('img,video,audio,source')){
      if(!anchor.dataset.bdayOriginalSrc)anchor.dataset.bdayOriginalSrc=anchor.getAttribute('src')||'';
      anchor.setAttribute('src',item.url);if('src' in anchor)anchor.src=item.url;anchor.dataset.bdayInserted=item.id||item.url;applyMediaPresentation(anchor,item);applyMediaFrame(anchor,item,anchor);anchor.load?.();return;
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
    applyMediaFrame(el,item,anchor);
  }
  function collapseGeneratedWrapper(node){
    let parent=node?.parentElement;
    let depth=0;
    while(parent&&depth++<3){
      const generated=parent.matches?.('.bday-added-media-group,[data-bday-group]');
      if(!generated)break;
      const visible=[...parent.children].some(child=>{
        if(child===node)return false;
        const style=getComputedStyle(child);
        return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
      });
      if(!visible&&!String(parent.textContent||'').trim())parent.style.setProperty('display','none','important');
      parent=parent.parentElement;
    }
  }
  function restoreGeneratedWrapper(node){
    let parent=node?.parentElement,depth=0;
    while(parent&&depth++<3){
      if(!parent.matches?.('.bday-added-media-group,[data-bday-group]'))break;
      parent.style.removeProperty('display');
      parent=parent.parentElement;
    }
  }
  function sectionGapTarget(anchor){
    if(!anchor)return null;
    if(PAGE==='memories.html'&&anchor.matches?.('article.beat')){
      const inner=anchor.querySelector(':scope > .beat-inner');
      if(inner)return inner;
    }
    const win=anchor.ownerDocument.defaultView,display=win.getComputedStyle(anchor).display;
    if(display==='grid'||display==='flex')return anchor;
    return [...anchor.children].find(child=>{const cs=win.getComputedStyle(child);return cs.display==='grid'||cs.display==='flex'})||anchor;
  }
  function applySectionLayout(anchor,layout){
    if(!anchor||!layout||typeof layout!=='object')return;
    const values=[
      ['padding-top',layout.paddingTop],['padding-bottom',layout.paddingBottom],
      ['margin-top',layout.marginTop],['margin-bottom',layout.marginBottom]
    ];
    for(const [prop,value] of values){
      const n=Number(value);
      if(Number.isFinite(n)&&n>=0)anchor.style.setProperty(prop,Math.min(400,n)+'px','important');
    }
    const gap=Number(layout.gap),target=sectionGapTarget(anchor);
    if(target&&Number.isFinite(gap)&&gap>=0)target.style.setProperty('gap',Math.min(200,gap)+'px','important');
  }
  function elementVisible(node){
    if(!node)return false;
    const s=node.ownerDocument.defaultView.getComputedStyle(node);
    return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';
  }
  function meaningfulVisibleContent(container){
    if(!container||!elementVisible(container))return false;
    for(const child of container.children){
      if(!elementVisible(child))continue;
      if(child.matches?.('img,video,audio,svg,canvas,button,a,input,textarea,select'))return true;
      if(String(child.textContent||'').trim())return true;
      if(meaningfulVisibleContent(child))return true;
    }
    return false;
  }
  function reconcileMemoriesChatSection(){
    if(PAGE!=='memories.html')return;
    const section=document.querySelector('.story > article.chat-beat');
    if(!section||section.dataset.bdayHidden==='1')return;
    const copy=section.querySelector(':scope > .chat-copy');
    const phone=section.querySelector(':scope > .phone');
    const empty=!meaningfulVisibleContent(copy)&&!meaningfulVisibleContent(phone);
    if(empty){
      section.style.setProperty('display','none','important');
      section.dataset.bdayAutoCollapsed='1';
    }else if(section.dataset.bdayAutoCollapsed==='1'){
      section.style.removeProperty('display');
      delete section.dataset.bdayAutoCollapsed;
    }
  }
  function applyPatch(anchor,patch,patchIndex){
    if(!anchor||isGeneratedTarget(anchor))return;
    if(patch.hidden){
      anchor.style.setProperty('display','none','important');
      anchor.dataset.bdayHidden='1';
      collapseGeneratedWrapper(anchor);
    }else if(anchor.dataset.bdayHidden==='1'){
      anchor.style.removeProperty('display');
      delete anchor.dataset.bdayHidden;
      restoreGeneratedWrapper(anchor);
    }
    if(patch.src&&anchor.matches?.('img,video,audio,source')){
      if(!anchor.dataset.bdayOriginalSrc)anchor.dataset.bdayOriginalSrc=anchor.getAttribute('src')||'';
      anchor.setAttribute('src',patch.src);if('src' in anchor)anchor.src=patch.src;anchor.load?.();
    }
    if(patch.text!==undefined&&patch.text!==null&&textEditable(anchor)&&!countdownManagedText(anchor))anchor.textContent=String(patch.text);
    if(patch.href&&anchor.matches?.('a')&&!anchor.matches?.('[data-journey-next],[data-journey-restart]'))anchor.setAttribute('href',patch.href);
    if(patch.styles&&typeof patch.styles==='object'){
      for(const [name,value] of Object.entries(patch.styles))if(value!==undefined&&value!==null&&value!==''){
        const priority=(name==='object-fit'||name==='object-position')?'important':'';
        anchor.style.setProperty(name,String(value),priority);
      }
    }
    if(patch.sectionLayout)applySectionLayout(anchor,patch.sectionLayout);
    if(patch.mediaLayout){
      if(anchor.matches?.('img,video')){
        applyMediaPresentation(anchor,patch.mediaLayout);
        applyMediaFrame(anchor,patch.mediaLayout,anchor);
      }else if(PAGE==='heart.html'&&anchor.matches?.('[data-model-page="heart"][data-model-index]')){
        const media=anchor.querySelector(':scope > img,:scope > video');
        if(media){
          applyMediaPresentation(media,patch.mediaLayout);
          applyMediaFrame(media,patch.mediaLayout,anchor);
        }
      }
    }
    const inserted=Array.isArray(patch.insertImages)?patch.insertImages:Array.isArray(patch.insertMedia)?patch.insertMedia:[];
    if(inserted.length&&mediaSlot(anchor))inserted.forEach((item,index)=>insertOne(anchor,item,patchIndex+'-'+index));
  }


  const MEDIA_FITS=new Set(['cover','contain','fill','none','scale-down']);
  const MEDIA_POSITIONS=new Set(['center center','center top','center bottom','left center','right center','left top','right top','left bottom','right bottom']);
  function rebuildPersistentMediaRules(patches){
    let style=document.getElementById('birthday-persistent-media-fit');
    if(!style){style=document.createElement('style');style.id='birthday-persistent-media-fit';document.head.appendChild(style)}
    const rules=[];
    for(const patch of patches||[]){
      if(!patch?.selector||GENERATED_SELECTOR.test(patch.selector))continue;
      const fit=String(patch.styles?.['object-fit']||'');
      const position=String(patch.styles?.['object-position']||'');
      if(!MEDIA_FITS.has(fit)&&!MEDIA_POSITIONS.has(position))continue;
      const declarations=[];
      if(MEDIA_FITS.has(fit))declarations.push('object-fit:'+fit+'!important');
      if(MEDIA_POSITIONS.has(position))declarations.push('object-position:'+position+'!important');
      if(declarations.length)rules.push(patch.selector+'{'+declarations.join(';')+';}');
    }
    style.textContent=rules.join('\n');
  }

  let cachedState=null;
  async function applyAll(forceRead=false){
    ensureEditIds(document);
    if(forceRead||!cachedState)cachedState=await readLive();
    const patches=cachedState?.patches?.[PAGE]||[];
    rebuildPersistentMediaRules(patches);
    patches.forEach((patch,index)=>{
      if(!patch?.selector||GENERATED_SELECTOR.test(patch.selector))return;
      const anchors=findTargets(patch.selector);anchors.forEach((anchor,targetIndex)=>applyPatch(anchor,patch,index+'-'+targetIndex));
    });
    reconcileMemoriesChatSection();
  }

  const style=document.createElement('style');
  style.textContent='[data-media-slot] > .bday-added-media{width:100%;height:100%;max-width:none;margin:0;border-radius:inherit;object-fit:cover}.bday-added-media-group:empty{display:none!important}.bday-added-media-group{display:grid;gap:14px;margin:16px 0}.bday-added-media{display:block;max-width:min(100%,680px);width:auto;height:auto;margin:0 auto;border-radius:18px;object-fit:cover}.bday-added-media-group>audio,.bday-added-media-group>video{width:min(100%,680px)}.bday-original-slot-content[hidden]{display:none!important}.node .bday-added-media{width:100%;height:100%;max-width:none;margin:0;border-radius:0;object-fit:cover}';
  document.head.appendChild(style);
  window.BDAY_PATCH_RUNTIME={ensureEditIds,findTarget,findTargets,mediaSlot,textEditable,restoreReplaceSlot,applyAll:()=>applyAll(true),reconcileLayout:reconcileMemoriesChatSection};
  [20,220,800,1800].forEach((delay,index)=>setTimeout(()=>applyAll(index===0),delay));
  let reapplyTimer=0;
  const observer=new MutationObserver(records=>{
    let changed=false;
    for(const record of records){
      for(const node of record.addedNodes){
        if(node?.nodeType!==1)continue;
        changed=true;
        if(node.matches?.(EDITABLE_SELECTOR)&&!isGeneratedTarget(node)&&!node.dataset.editId){
          node.dataset.editId='be-'+hash32(PAGE+'|'+structuralKey(node));
        }
        ensureEditIds(node);
      }
    }
    if(changed){
      clearTimeout(reapplyTimer);
      reapplyTimer=setTimeout(()=>applyAll(false),40);
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();