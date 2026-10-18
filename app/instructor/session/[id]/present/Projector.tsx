'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Maximize,Lock,CheckCheck,RefreshCw,ScanLine,Unlock} from 'lucide-react';
import {BrandMark} from '@/components/Shell';
import {CountUp} from '@/components/CountUp';
import {useLiveSession,postJson} from '../useLiveSession';
import {pureBlackQr} from '../pureBlackQr';
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
  // Pure black modules on pure white, whatever colour the server drew.
  const qrSrc=useMemo(()=>pureBlackQr(challenge?.qrImage),[challenge?.qrImage]);

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
  // It appears in the side panel, so it never covers the QR.
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
  const seconds=Math.ceil(remainingMs/1000);

  return <div className={styles.stage}>
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <span className={styles.brand}><BrandMark size={26}/>EUI Attendance</span>
        <h1>{heading}</h1>
        <p>{room}{room?' · ':''}Open <b>Check in</b> on the EUI Attendance website and scan with its camera</p>
      </div>
      <button type="button" className={styles.fsButton} onClick={toggleFullscreen} aria-label="Fullscreen (Shift+F)"><Maximize size={20}/></button>
    </header>
    <main className={styles.main}>
      {/* The QR card never animates, blurs, scales, fades or gets covered. */}
      <div className={styles.qrArea}>
        {ended?<div className={styles.bigState}><CheckCheck size={64} aria-hidden="true"/><b>Session ended</b></div>
          :closed?<div className={styles.bigState}><Lock size={64} aria-hidden="true"/><b>Check-in closed</b><span>Ask your instructor if you could not scan.</span></div>
          :qrSrc?<img className={styles.qr} src={qrSrc} alt="Attendance QR code"/>
          :<div className={styles.bigState}><RefreshCw size={48} className="spin" aria-hidden="true"/><span>Loading…</span></div>}
      </div>
      <aside className={styles.side}>
        {notice&&<div className={styles.notice} role="status" aria-live="assertive">{notice==='QR closed'?<Lock size={28} aria-hidden="true"/>:<Unlock size={28} aria-hidden="true"/>}<b>{notice}</b></div>}
        {!ended&&!closed&&<div className={styles.ringWrap} aria-label={`Code changes in ${seconds} seconds`}>
          <svg viewBox="0 0 120 120" className={styles.ring} aria-hidden="true">
            <circle cx="60" cy="60" r={RING_R} className={styles.ringTrack}/>
            <circle cx="60" cy="60" r={RING_R} className={styles.ringFill} strokeDasharray={RING_C} strokeDashoffset={RING_C*(1-fraction)}/>
          </svg>
          <span className={styles.ringText}>{seconds}</span>
          <small>new code</small>
        </div>}
        <div className={styles.counter}>
          <div className={styles.counterNums}>{counts?<CountUp value={counts.attended}/>:<b>—</b>}<span>/ {counts?.roster??'—'}</span></div>
          <small>checked in</small>
          {counts&&<div className={styles.counterBar} aria-hidden="true"><span style={{width:`${counts.roster?Math.min(100,100*counts.attended/counts.roster):0}%`}}/></div>}
        </div>
        <ol className={styles.feed} aria-label="Latest check-ins">
          {(live?.recent??[]).map(r=><li key={r.name+r.checkedInAt} className={styles.feedItem}><ScanLine size={18} aria-hidden="true"/>{shortName(r.name)}</li>)}
        </ol>
        {error&&<p className={styles.error}>{error}</p>}
      </aside>
    </main>
    <footer className={styles.footer}><span><kbd>Shift</kbd>+<kbd>F</kbd> fullscreen</span><span><kbd>Shift</kbd>+<kbd>C</kbd> {closed?'reopen':'close'} QR</span>{busy&&<span>saving…</span>}<span className={styles.footNote}>Student project prototype · Not an official EUI system</span></footer>
  </div>;
}
