(()=>{
  const PREF='birthdayMusic';
  const PLAYBACK='birthdaySoundtrackPlaybackV2';
  const CONTROL='[data-soundtrack-control]';
  let audio=null,tracks=[],trackIndex=0,wanted=false,gestureArmed=false,shuffle=false,lastSavedSecond=-1;

  function config(){
    try{
      const state=window.BDAY?.read?.();
      if(state?.general)return state.general;
    }catch(e){}
    return window.SITE_CONFIG||{};
  }
  function pageKey(){
    const raw=(location.pathname.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
    return raw==='entry.html'?'index.html':raw;
  }
  function validUrl(value){
    const s=typeof value==='string'?value.trim():'';
    if(!s||s==='song.mp3'||s==='projector.mp3'||s==='add song.mp3'||s==='add projector.mp3')return '';
    return s;
  }
  function normalizeTrack(track,index){
    if(typeof track==='string'){
      const url=validUrl(track);return url?{url,name:'Track '+(index+1)}:null;
    }
    if(!track||typeof track!=='object')return null;
    const url=validUrl(track.url);
    if(!url)return null;
    return {url,name:String(track.name||('Track '+(index+1))).trim()||('Track '+(index+1))};
  }
  function playlistFor(g){
    const hasModel=!!g?.soundtrack&&typeof g.soundtrack==='object'&&!Array.isArray(g.soundtrack);
    const model=hasModel?g.soundtrack:{};
    const overrides=model.pageTracks&&typeof model.pageTracks==='object'?model.pageTracks:{};
    const key=pageKey();
    const source=Object.prototype.hasOwnProperty.call(overrides,key)
      ? (Array.isArray(overrides[key])?overrides[key]:[])
      : (Array.isArray(model.defaultTracks)?model.defaultTracks:[]);
    let list=source.map(normalizeTrack).filter(Boolean);
    if(!hasModel){
      const legacy=validUrl(g?.musicFile);
      if(legacy)list=[{url:legacy,name:'Shared soundtrack'}];
    }
    return {tracks:list,shuffle:!!model.shuffle};
  }
  function controls(){return [...document.querySelectorAll(CONTROL)]}
  function currentTrack(){return tracks[trackIndex]||null}
  function labelFor(btn,on){
    const label=btn.querySelector('[data-soundtrack-label]');
    const target=label||btn;
    const track=currentTrack();
    const off=btn.dataset.soundOffLabel||'sound';
    const onLabel=btn.dataset.soundOnLabel||'sound on';
    target.textContent=on?(tracks.length>1?(onLabel+' · '+(track?.name||'')):onLabel):off;
    const icon=btn.querySelector('[data-soundtrack-icon]');
    if(icon)icon.textContent=on?'❚❚':'♫';
  }
  function updateControls(){
    const available=tracks.length>0,on=!!audio&&!audio.paused&&available;
    for(const btn of controls()){
      btn.hidden=!available;
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.dataset.soundtrackCount=String(tracks.length);
      labelFor(btn,on);
    }
  }
  function readPlayback(){
    try{return JSON.parse(sessionStorage.getItem(PLAYBACK)||'{}')||{}}catch(e){return {}}
  }
  function savePlayback(){
    const track=currentTrack();if(!track)return;
    const second=Math.floor(Number(audio?.currentTime||0));
    if(second===lastSavedSecond)return;lastSavedSecond=second;
    try{sessionStorage.setItem(PLAYBACK,JSON.stringify({url:track.url,time:Number(audio?.currentTime||0),page:pageKey()}))}catch(e){}
  }
  function attachAudio(track,resumeTime=0){
    audio?.pause?.();audio?.remove?.();audio=null;
    if(!track)return null;
    audio=document.createElement('audio');
    audio.id='birthdaySharedSoundtrack';
    audio.dataset.soundtrackUrl=track.url;
    audio.src=track.url;audio.loop=tracks.length===1;audio.preload='metadata';audio.volume=.72;audio.style.display='none';
    document.body.appendChild(audio);
    audio.addEventListener('loadedmetadata',()=>{
      if(Number.isFinite(resumeTime)&&resumeTime>0&&audio?.duration&&resumeTime<audio.duration-1){
        try{audio.currentTime=resumeTime}catch(e){}
      }
    },{once:true});
    audio.addEventListener('play',updateControls);
    audio.addEventListener('pause',()=>{savePlayback();updateControls()});
    audio.addEventListener('timeupdate',savePlayback);
    audio.addEventListener('ended',()=>advance(1,true));
    audio.addEventListener('error',()=>{updateControls()});
    return audio;
  }
  function chooseNext(direction=1){
    if(!tracks.length)return -1;
    if(tracks.length===1)return 0;
    if(shuffle){
      let next=trackIndex;
      while(next===trackIndex)next=Math.floor(Math.random()*tracks.length);
      return next;
    }
    return (trackIndex+direction+tracks.length)%tracks.length;
  }
  async function setTrack(index,{autoplay=wanted,resumeTime=0}={}){
    if(!tracks.length){trackIndex=0;audio?.pause?.();audio?.remove?.();audio=null;updateControls();return false}
    trackIndex=Math.max(0,Math.min(tracks.length-1,index));
    attachAudio(currentTrack(),resumeTime);
    updateControls();
    if(autoplay)return play();
    return true;
  }
  async function advance(direction=1,autoplay=wanted){
    const next=chooseNext(direction);
    if(next<0)return false;
    return setTrack(next,{autoplay,resumeTime:0});
  }
  async function play(){
    if(!tracks.length)return false;
    const a=audio||attachAudio(currentTrack(),0);wanted=true;
    try{sessionStorage.setItem(PREF,'on')}catch(e){}
    try{await a.play();gestureArmed=false;updateControls();return true}catch(e){armGesture();updateControls();return false}
  }
  function pause(){
    wanted=false;try{sessionStorage.setItem(PREF,'off')}catch(e){}
    savePlayback();audio?.pause?.();updateControls();
  }
  async function toggle(){
    if(!tracks.length)return false;
    if(audio&&!audio.paused){pause();return false}
    return play();
  }
  function armGesture(){
    if(gestureArmed||!wanted||!tracks.length)return;
    gestureArmed=true;
    const resume=async e=>{
      if(e.target?.closest?.(CONTROL))return;
      document.removeEventListener('pointerdown',resume,true);
      gestureArmed=false;
      if(wanted)await play();
    };
    document.addEventListener('pointerdown',resume,true);
  }
  function samePlaylist(a,b){
    return a.length===b.length&&a.every((track,index)=>track.url===b[index]?.url);
  }
  function applyGeneral(g){
    const next=playlistFor(g);
    const nextTracks=next.tracks;shuffle=next.shuffle;
    let stored=null;try{stored=sessionStorage.getItem(PREF)}catch(e){}
    wanted=stored==='on'||(stored===null&&g?.soundDefault===true);

    const playback=readPlayback();
    const oldTrack=currentTrack();
    const unchanged=samePlaylist(tracks,nextTracks);
    tracks=nextTracks;

    if(!tracks.length){
      audio?.pause?.();audio?.remove?.();audio=null;trackIndex=0;updateControls();return;
    }

    let nextIndex=0,resumeTime=0;
    const currentUrl=oldTrack?.url||audio?.dataset?.soundtrackUrl||playback.url||'';
    const currentIndex=tracks.findIndex(track=>track.url===currentUrl);
    if(currentIndex>=0){
      nextIndex=currentIndex;
      if(playback.url===tracks[nextIndex].url)resumeTime=Number(playback.time||0);
      else if(audio?.dataset?.soundtrackUrl===tracks[nextIndex].url)resumeTime=Number(audio.currentTime||0);
    }else if(playback.url){
      const savedIndex=tracks.findIndex(track=>track.url===playback.url);
      if(savedIndex>=0){nextIndex=savedIndex;resumeTime=Number(playback.time||0)}
    }

    const activeUrl=audio?.dataset?.soundtrackUrl||'';
    if(!unchanged||activeUrl!==tracks[nextIndex].url){
      trackIndex=nextIndex;attachAudio(currentTrack(),resumeTime);
    }else trackIndex=nextIndex;

    updateControls();
    if(wanted)play();
  }
  function bind(){
    applyGeneral(config());
    document.addEventListener('click',e=>{
      const btn=e.target?.closest?.(CONTROL);if(!btn)return;
      e.preventDefault();e.stopImmediatePropagation();toggle();
    },true);
    const ready=window.BDAY?.ready||window.BDAY?.load?.();
    if(ready)Promise.resolve(ready).then(r=>{if(r?.state?.general)applyGeneral(r.state.general)}).catch(()=>{});
    window.addEventListener('birthday:state',e=>{if(e.detail?.state?.general)applyGeneral(e.detail.state.general)});
  }
  window.BIRTHDAY_SOUNDTRACK={
    play,pause,toggle,next:()=>advance(1,true),previous:()=>advance(-1,true),
    refresh:()=>applyGeneral(config()),
    get url(){return currentTrack()?.url||''},
    get track(){return currentTrack()},
    get tracks(){return tracks.slice()},
    get page(){return pageKey()}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();