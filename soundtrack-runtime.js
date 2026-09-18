(()=>{
  const PREF='birthdayMusic';
  const CONTROL='[data-soundtrack-control]';
  let audio=null,url='',wanted=false,gestureArmed=false;

  function config(){
    try{
      const state=window.BDAY?.read?.();
      if(state?.general)return state.general;
    }catch(e){}
    return window.SITE_CONFIG||{};
  }
  function validUrl(value){
    const s=typeof value==='string'?value.trim():'';
    if(!s||s==='song.mp3'||s==='projector.mp3'||s==='add song.mp3'||s==='add projector.mp3')return '';
    return s;
  }
  function controls(){return [...document.querySelectorAll(CONTROL)]}
  function labelFor(btn,on){
    const label=btn.querySelector('[data-soundtrack-label]');
    const target=label||btn;
    target.textContent=on?(btn.dataset.soundOnLabel||'sound on'):(btn.dataset.soundOffLabel||'sound');
    const icon=btn.querySelector('[data-soundtrack-icon]');
    if(icon)icon.textContent=on?'❚❚':'♫';
  }
  function updateControls(){
    const available=!!url,on=!!audio&&!audio.paused&&available;
    for(const btn of controls()){
      btn.hidden=!available;
      btn.setAttribute('aria-pressed',on?'true':'false');
      labelFor(btn,on);
    }
  }
  function ensureAudio(){
    if(!url)return null;
    if(audio&&audio.dataset.soundtrackUrl===url)return audio;
    audio?.pause?.();
    audio=document.createElement('audio');
    audio.id='birthdaySharedSoundtrack';
    audio.dataset.soundtrackUrl=url;
    audio.src=url;audio.loop=true;audio.preload='metadata';audio.volume=.72;audio.style.display='none';
    document.body.appendChild(audio);
    audio.addEventListener('play',updateControls);
    audio.addEventListener('pause',updateControls);
    audio.addEventListener('error',()=>{wanted=false;sessionStorage.setItem(PREF,'off');updateControls()});
    return audio;
  }
  async function play(){
    if(!url)return false;
    const a=ensureAudio();wanted=true;sessionStorage.setItem(PREF,'on');
    try{await a.play();gestureArmed=false;updateControls();return true}catch(e){armGesture();updateControls();return false}
  }
  function pause(){
    wanted=false;sessionStorage.setItem(PREF,'off');audio?.pause?.();updateControls();
  }
  async function toggle(){
    if(!url)return false;
    if(audio&&!audio.paused){pause();return false}
    return play();
  }
  function armGesture(){
    if(gestureArmed||!wanted||!url)return;
    gestureArmed=true;
    const resume=async e=>{
      if(e.target?.closest?.(CONTROL))return;
      document.removeEventListener('pointerdown',resume,true);
      gestureArmed=false;
      if(wanted)await play();
    };
    document.addEventListener('pointerdown',resume,true);
  }
  function applyGeneral(g){
    const next=validUrl(g?.musicFile);
    if(next!==url){audio?.pause?.();audio?.remove?.();audio=null;url=next}
    let stored=null;try{stored=sessionStorage.getItem(PREF)}catch(e){}
    wanted=stored==='on'||(stored===null&&g?.soundDefault===true);
    updateControls();
    if(url&&wanted)play();
    else if(!url){audio?.pause?.();audio?.remove?.();audio=null;updateControls()}
  }
  function bind(){
    applyGeneral(config());
    document.addEventListener('click',e=>{
      const btn=e.target?.closest?.(CONTROL);if(!btn)return;
      e.preventDefault();e.stopImmediatePropagation();toggle();
    },true);
    if(window.BDAY?.fetchRemote){
      window.BDAY.fetchRemote().then(r=>{if(r?.state?.general)applyGeneral(r.state.general)}).catch(()=>{});
    }
  }
  window.BIRTHDAY_SOUNDTRACK={play,pause,toggle,refresh:()=>applyGeneral(config()),get url(){return url}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();