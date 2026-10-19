'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {MapPin,AlertTriangle,RotateCcw,Loader2,Info} from 'lucide-react';
import {StateBadge,displayTime} from '@/components/Shell';
import {QrScanner,type ScannerProblem} from './QrScanner';

type Fix={lat:number,lon:number,accuracy:number,at:number};
type Outcome={kind:'success',status:string,verification:string,location:string,at:number}|{kind:'stop',code:string,message:string,retry:boolean};

const FRESH_MS=30000;      // only readings from the last 30 s are used
const SLOW_MS=20000;       // after 20 s without any reading, tell the student plainly
// Server answers that mean "this code is not usable, keep scanning for the current one".
const RESCAN:Record<string,string>={
  expired:'Code just changed · hold steady…',
  invalid_qr:'Not the current code · scanning again…',
  not_issued:'Not the current code · scanning again…',
};
const CAMERA_PROBLEM:Record<ScannerProblem,string>={
  denied:'Allow the camera in your browser settings, or ask your instructor.',
  no_camera:'No camera found. Ask your instructor.',
  insecure:'The camera needs a secure (https) page. Ask your instructor.',
  failed:'Close other camera apps and try again, or ask your instructor.',
};
const LOCATION_NOTE:Record<string,string>={
  inside:'Location matched the room.',
  uncertain:'Location unclear · your instructor will review.',
  no_location:'No location · your instructor will review.',
  no_anchor:'No room location yet · your instructor will review.',
};

// The best reading is the most precise one (smallest ± metres) from the last 30 seconds.
function bestFix(fixes:Fix[],now:number):Fix|null{
  return fixes.filter(f=>now-f.at<=FRESH_MS).reduce<Fix|null>((best,f)=>!best||f.accuracy<best.accuracy?f:best,null);
}
// A random browser id, kept in this browser only. The server stores a salted hash (rules R1/R2).
function deviceId(){
  try{const key='eui-demo-browser-id';let v=localStorage.getItem(key);if(!v){v=crypto.randomUUID();localStorage.setItem(key,v);}return v;}
  catch{return undefined;}
}

export function CheckinClient({intervalSeconds}:{intervalSeconds:number}){
  const[outcome,setOutcome]=useState<Outcome|null>(null);
  const[scanning,setScanning]=useState(true);
  const[note,setNote]=useState('');
  const[locState,setLocState]=useState<'waiting'|'tracking'|'denied'|'unsupported'>('waiting');
  const[slow,setSlow]=useState(false);
  const[now,setNow]=useState(()=>Date.now());
  const fixes=useRef<Fix[]>([]);
  const busy=useRef(false);
  const rejected=useRef(new Set<string>());   // codes the server already refused: never resend them
  const done=outcome!==null;

  // Location starts when the page opens, because a code lives only a few seconds:
  // it must be ready before the scan. It stops when check-in is finished or the page closes.
  useEffect(()=>{
    if(done)return;
    if(!('geolocation' in navigator)){setLocState('unsupported');return;}
    const watch=navigator.geolocation.watchPosition(
      p=>{const at=Date.now();fixes.current=[...fixes.current.filter(f=>at-f.at<=FRESH_MS),{lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,at}];setLocState('tracking');setNow(at);},
      err=>{if(err.code===err.PERMISSION_DENIED)setLocState('denied');},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    const slowTimer=setTimeout(()=>setSlow(true),SLOW_MS);
    const tick=setInterval(()=>setNow(Date.now()),2000); // refreshes the "±m" line only; nothing is sent
    return()=>{navigator.geolocation.clearWatch(watch);clearTimeout(slowTimer);clearInterval(tick);};
  },[done]);

  const finish=useCallback((o:Outcome)=>{setScanning(false);setOutcome(o);setNote('');},[]);

  // Called by the scanner with an "EUIA1." payload. Submits at once with the best reading (or none).
  const onCode=useCallback(async(payload:string)=>{
    if(busy.current||rejected.current.has(payload))return;
    busy.current=true;setScanning(false);setNote('Checking in…');
    const fix=bestFix(fixes.current,Date.now());
    try{
      const res=await fetch('/api/checkin',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token:payload,deviceId:deviceId(),...(fix?{lat:fix.lat,lon:fix.lon,accuracy:fix.accuracy}:{})})});
      const data=await res.json().catch(()=>({}));
      if(res.ok)return finish({kind:'success',status:data.status,verification:data.verification,location:data.location,at:Date.now()});
      if(RESCAN[data.code]){rejected.current.add(payload);setNote(RESCAN[data.code]);setScanning(true);return;}
      finish({kind:'stop',code:data.code||'error',message:data.error||'Unable to check in.',retry:res.status>=500||data.code==='bad_location'});
    }catch{finish({kind:'stop',code:'network',message:'No connection. Check your internet.',retry:true});}
    finally{busy.current=false;}
  },[finish]);
  const onOtherCode=useCallback(()=>setNote('Not an attendance code.'),[]);
  const onProblem=useCallback((p:ScannerProblem)=>finish({kind:'stop',code:'camera_'+p,message:CAMERA_PROBLEM[p],retry:p==='denied'||p==='failed'}),[finish]);
  function retry(){rejected.current.clear();setOutcome(null);setNote('');setSlow(false);setScanning(true);}

  const best=bestFix(fixes.current,now);
  const noLocation=locState==='denied'||locState==='unsupported'||(slow&&!best);

  // While the camera runs, this page has no animation at all: the phone's power goes to the scanner.
  // Only the result (after the camera has stopped) plays its one-time animation.
  return <div className="checkin-solo"><div className="card checkin-card">
    {!outcome&&<>
      <h2>Scan the code</h2>
      <div className={'loc '+(best?(best.accuracy<=150?'good':'weak'):'')} aria-live="polite"><MapPin size={15} aria-hidden="true"/>
        {best?<span>Location <span className="num">±{Math.round(best.accuracy)} m</span></span>:locState==='denied'?<span>Location off</span>:locState==='unsupported'?<span>No location in this browser</span>:<span>Finding location…</span>}
      </div>
      {noLocation&&<div className="alert alert-warn"><Info size={16} aria-hidden="true"/><span>No location · your check-in goes to review</span></div>}
      <div className="scanner-frame">{scanning?<QrScanner active={scanning} onCode={onCode} onOtherCode={onOtherCode} onProblem={onProblem}/>:<div className="scanner-wait"><Loader2 size={28} className="spin" aria-hidden="true"/><span>Checking in…</span></div>}</div>
      <p className="scan-note" aria-live="polite">{note}</p>
    </>}
    {outcome?.kind==='success'&&<div className="result" role="status">
      <ResultMark tone={outcome.verification==='verified'?'ok':'warn'}/>
      <h2>You’re checked in</h2>
      <div className="badges"><StateBadge value={outcome.status}/><StateBadge value={outcome.verification}/></div>
      <p>{LOCATION_NOTE[outcome.location]||''}</p>
      <time dateTime={new Date(outcome.at).toISOString()}>{displayTime(new Date(outcome.at))}</time>
      <div className="actions"><Link className="btn btn-primary btn-lg" href="/student">Done</Link></div>
    </div>}
    {outcome?.kind==='stop'&&<div className="result" role="status">
      {outcome.code==='already'?<ResultMark tone="ok"/>:<div className="result-mark warn"><div className="disc"><AlertTriangle size={36} color="#fff" aria-hidden="true"/></div></div>}
      <h2>{outcome.code==='already'?'Already checked in':outcome.code==='qr_closed'?'Check-in is closed':outcome.code.startsWith('camera_')?'Camera not available':'Check-in not recorded'}</h2>
      <p>{outcome.message}</p>
      <div className="actions">{outcome.retry&&<button type="button" className="btn btn-primary btn-lg" onClick={retry}><RotateCcw size={16} aria-hidden="true"/>Try again</button>}<Link className="btn btn-secondary btn-lg" href="/student">Done</Link></div>
    </div>}
  </div>
  {!outcome&&<p className="footnote">Codes rotate every <span className="num">{intervalSeconds}</span> s · Location checked by server</p>}
  </div>;
}

// The success moment: the disc pops in, two waves ripple out and the tick draws itself. Plays once.
function ResultMark({tone}:{tone:'ok'|'warn'}){
  return <div className={'result-mark'+(tone==='warn'?' warn':'')} aria-hidden="true">
    <span className="wave"/><span className="wave w2"/>
    <div className="disc"><svg width="40" height="40" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
  </div>;
}
