(()=>{
  const STATE_KEY='birthday-site-state-v2';
  const UNLOCK_KEY='birthdayUnlocked';
  const FALLBACK_BIRTHDAY='2026-09-18T00:00:00+05:30';
  const CANONICAL=['countdown.html','index.html','memories.html','pretty-photos.html','heart.html','yapping.html','finale.html'];
  const REMOVED=new Set(['fair.html']);
  const ESSENTIAL=new Set(['countdown.html','index.html','finale.html']);
  const raw=location.pathname.split('/').filter(Boolean).pop()||'index.html';
  const key=raw==='entry.html'?'index.html':raw;
  const query=new URLSearchParams(location.search);
  const preview=query.get('adminPreview')==='1';

  function parseCached(){
    try{
      if(window.BDAY?.read)return window.BDAY.read();
      const parsed=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch(e){return {}}
  }
  function normalizedOrder(state){
    const order=Array.isArray(state?.pageOrder)?state.pageOrder:[];
    if(order.length!==CANONICAL.length||new Set(order).size!==CANONICAL.length)return CANONICAL.slice();
    if(CANONICAL.some(p=>!order.includes(p)))return CANONICAL.slice();
    if(order[0]!=='countdown.html'||order[1]!=='index.html'||order[order.length-1]!=='finale.html')return CANONICAL.slice();
    return order.slice();
  }
  function enabled(state,page){
    if(ESSENTIAL.has(page))return true;
    return state?.pageEnabled?.[page]!==false;
  }
  function route(page){return page==='index.html'?'entry.html':page}
  function previewSuffix(){
    if(!preview)return '';
    const out=new URLSearchParams();out.set('adminPreview','1');
    if(query.has('t'))out.set('t',query.get('t'));
    return '?'+out.toString();
  }
  function go(page,replace=false){
    const url=route(page)+(preview?previewSuffix():'');
    if(replace)location.replace(url);else location.href=url;
  }
  function birthdayTime(stateValue=state){
    const rawValue=stateValue?.general?.birthdayISO||FALLBACK_BIRTHDAY;
    const parsed=new Date(rawValue);
    const fallback=new Date(FALLBACK_BIRTHDAY);
    return Number.isNaN(parsed.getTime())?fallback.getTime():parsed.getTime();
  }
  function unlocked(){
    if(Date.now()<birthdayTime())return false;
    try{
      if(localStorage.getItem(UNLOCK_KEY)!=='1')return false;
      const current=String(state?.general?.birthdayISO||FALLBACK_BIRTHDAY);
      return localStorage.getItem('birthdayUnlockedFor')===current;
    }catch(e){return false}
  }
  function nextKey(state,current=key){
    const order=normalizedOrder(state);
    const i=order.indexOf(current);if(i<0)return null;
    for(let n=i+1;n<order.length;n++)if(enabled(state,order[n]))return order[n];
    return null;
  }
  function firstAfterEntry(state){
    return nextKey(state,'index.html')||'finale.html';
  }
  function guard(state){
    if(preview){
      if(raw==='index.html')go('index.html',true);
      return false;
    }
    const open=unlocked();
    if(raw==='index.html'){
      go(open?'index.html':'countdown.html',true);
      return true;
    }
    if(raw==='countdown.html'){
      if(open){go('index.html',true);return true}
      return false;
    }
    if(!open){
      go('countdown.html',true);
      return true;
    }
    if(REMOVED.has(key)){
      go('finale.html',true);
      return true;
    }
    if(CANONICAL.includes(key)&&!enabled(state,key)){
      const next=nextKey(state,key)||'finale.html';
      go(next,true);return true;
    }
    return false;
  }
  function markNavigation(state){
    if(!document.body)return;
    const next=nextKey(state,key);
    const candidates=[...document.querySelectorAll('a.next,#nextLink,#nextBtn,[data-journey-next]')];
    for(const a of candidates){
      if(!a.matches('a'))continue;
      a.dataset.journeyNext='1';
      if(next)a.setAttribute('href',route(next)+(preview?previewSuffix():''));
      else a.removeAttribute('href');
    }
    for(const a of document.querySelectorAll('[data-journey-restart]')){
      if(a.matches('a'))a.setAttribute('href','entry.html'+(preview?previewSuffix():''));
    }
  }
  let state=parseCached();
  if(guard(state))return;

  function wire(){markNavigation(state)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();

  document.addEventListener('click',e=>{
    const nextLink=e.target?.closest?.('[data-journey-next]');
    if(nextLink){
      const next=nextKey(state,key);
      if(next){e.preventDefault();go(next,false)}
      return;
    }
    const restart=e.target?.closest?.('[data-journey-restart]');
    if(restart){e.preventDefault();go('index.html',false)}
  },true);

  function syncRemote(){
    const ready=window.BDAY?.ready||window.BDAY?.load?.();
    if(!ready)return;
    Promise.resolve(ready).then(r=>{
      if(!r?.state)return;state=r.state;
      if(!guard(state))markNavigation(state);
    }).catch(()=>{});
  }
  syncRemote();

  window.BIRTHDAY_JOURNEY={
    canonical:CANONICAL.slice(),
    birthdayISO:()=>state?.general?.birthdayISO||FALLBACK_BIRTHDAY,
    birthdayReached:()=>Date.now()>=birthdayTime(),
    unlocked,
    next:()=>{const n=nextKey(state,key);if(n)go(n,false)},
    restart:()=>go('index.html',false),
    firstAfterEntry:()=>firstAfterEntry(state),
    routeForKey:route
  };
})();