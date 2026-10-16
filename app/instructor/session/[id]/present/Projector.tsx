'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Maximize,Lock,CheckCheck,RefreshCw} from 'lucide-react';
import {useLiveSession,postJson} from '../useLiveSession';
import styles from './present.module.css';

// "Mariam Tarek" → "Mariam T." — the projector is seen by the whole class, so full names are not shown.
function shortName(full:string){const parts=full.trim().split(/\s+/);return parts.length>1?`${parts[0]} ${parts[parts.length-1][0]}.`:parts[0];}

const RING_R=52,RING_C=2*Math.PI*RING_R; // countdown ring geometry (SVG units)

export function Projector({sessionId,heading,room,initiallyActive}:{sessionId:string,heading:string,room:string,initiallyActive:boolean}){
  const {live,challenge,error,setError,remainingMs,refresh}=useLiveSession(sessionId,initiallyActive);
  const[busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const ended=live?live.state==='ended':!initiallyActive;
  const closed=!ended&&challenge?.state==='qr_closed';

  // Fullscreen can be refused by the browser (or not exist, e.g. iPhone Safari): fail quietly.
  const toggleFullscreen=useCallback(()=>{
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    else document.documentElement.requestFullscreen?.().catch(()=>{});
  },[]);
  const toggleQr=useCallback(async()=>{
    if(busyRef.current||ended||!challenge)return;
    busyRef.current=true;setBusy(true);
    try{await postJson(`/api/sessions/${sessionId}/qr`,{open:challenge.state==='qr_closed'});refresh();}
    catch(e){setError(e instanceof Error?e.message:'Could not change the QR.');}
    finally{busyRef.current=false;setBusy(false);}
  },[challenge,ended,sessionId,refresh,setError]);

  // Keyboard: Shift+F = fullscreen, Shift+C = close or reopen the QR.
  // Shift is required, so normal typing on the projector laptop cannot change anything.
  // e.code is the physical key, so this also works with Caps Lock or another keyboard language.
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if(e.repeat||!e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;
      const el=document.activeElement as HTMLElement|null;
      if(el&&(el.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(el.tagName)))return; // typing in a field
      if(e.code==='KeyF'){e.preventDefault();toggleFullscreen();}
      if(e.code==='KeyC'){e.preventDefault();toggleQr();}
    }
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[toggleFullscreen,toggleQr]);

  // A large notice for 2 seconds whenever the QR is closed or reopened, from any screen
  // (this keyboard, the live board, or the instructor's phone). Nothing is shown on first load.
  const qrState=challenge?(ended?'ended':challenge.state):null;
  const lastQrState=useRef<string|null>(null);
  const[notice,setNotice]=useState<string|null>(null);
  useEffect(()=>{
    const before=lastQrState.current;
    if(qrState)lastQrState.current=qrState;
    if(!before||!qrState||before===qrState)return;
    if(qrState==='qr_closed'||(qrState==='active'&&before==='qr_closed')){
      setNotice(qrState==='qr_closed'?'QR closed':'QR reopened');
      const t=setTimeout(()=>setNotice(null),2000);
      return()=>clearTimeout(t);
    }
  },[qrState]);

  const total=(challenge?.intervalSeconds??8)*1000;
  const fraction=Math.min(1,remainingMs/total);
  const counts=live?.counts;

  return <div className={styles.stage}>
    <header className={styles.header}>
      <div><h1>{heading}</h1><p>{room}{room?' · ':''}Scan with the EUI website: Check in → camera</p></div>
      <button type="button" className={styles.fsButton} onClick={toggleFullscreen} aria-label="Fullscreen (Shift+F)"><Maximize size={22}/></button>
    </header>
    <main className={styles.main}>
      <div className={styles.qrArea}>
        {ended?<div className={styles.bigState}><CheckCheck size={72}/><b>Session ended</b></div>
          :closed?<div className={styles.bigState}><Lock size={72}/><b>Check-in closed</b><span>Ask your instructor if you could not scan.</span></div>
          :challenge?.qrImage?<img className={styles.qr} src={challenge.qrImage} alt="Attendance QR code"/>
          :<div className={styles.bigState}><RefreshCw size={56}/><span>Loading…</span></div>}
      </div>
      <aside className={styles.side}>
        {!ended&&!closed&&<div className={styles.ringWrap} aria-label={`Code changes in ${Math.ceil(remainingMs/1000)} seconds`}>
          <svg viewBox="0 0 120 120" className={styles.ring}>
            <circle cx="60" cy="60" r={RING_R} className={styles.ringTrack}/>
            <circle cx="60" cy="60" r={RING_R} className={styles.ringFill} strokeDasharray={RING_C} strokeDashoffset={RING_C*(1-fraction)}/>
          </svg>
          <span className={styles.ringText}>{Math.ceil(remainingMs/1000)}</span>
          <small>new code</small>
        </div>}
        <div className={styles.counter}><b>{counts?.attended??'—'}</b><span>/ {counts?.roster??'—'}</span><small>checked in</small></div>
        <ol className={styles.feed} aria-label="Latest check-ins">
          {(live?.recent??[]).map(r=><li key={r.name+r.checkedInAt} className={styles.feedItem}>{shortName(r.name)}</li>)}
        </ol>
        {error&&<p className={styles.error}>{error}</p>}
      </aside>
    </main>
    <footer className={styles.footer}>Shift+F fullscreen · Shift+C {closed?'reopen':'close'} QR{busy?' · saving…':''}</footer>
    {notice&&<div className={styles.notice} role="status" aria-live="assertive"><b>{notice}</b></div>}
  </div>;
}
