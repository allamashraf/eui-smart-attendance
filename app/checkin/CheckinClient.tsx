'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Camera,MapPin,ShieldCheck,CheckCircle2,AlertTriangle,RotateCcw,Loader2} from 'lucide-react';
import {StateBadge} from '@/components/Shell';
import {QrScanner,type ScannerProblem} from './QrScanner';

type Fix={lat:number,lon:number,accuracy:number,at:number};
type Outcome={kind:'success',status:string,verification:string,location:string}|{kind:'stop',code:string,message:string,retry:boolean};

const FRESH_MS=30000;      // only readings from the last 30 s are used
const SLOW_MS=20000;       // after 20 s without any reading, tell the student plainly
// Server answers that mean "this code is not usable, keep scanning for the current one".
const RESCAN:Record<string,string>={
  expired:'That code had just changed. Hold your phone steady on the screen…',
  invalid_qr:'That is not the current attendance code. Scanning again…',
  not_issued:'That is not the current attendance code. Scanning again…',
};
const CAMERA_PROBLEM:Record<ScannerProblem,string>={
  denied:'Camera access was blocked. Allow the camera for this site in your browser settings and try again, or ask your instructor for assisted check-in.',
  no_camera:'No camera was found on this device. Ask your instructor for assisted check-in.',
  insecure:'The camera only works on a secure (https) page. Ask your instructor for assisted check-in.',
  failed:'The camera could not start. Close other apps that use the camera and try again, or ask your instructor for assisted check-in.',
};
const LOCATION_NOTE:Record<string,string>={
  inside:'Your location matched the classroom.',
  uncertain:'Your location was not precise or close enough to confirm, so your instructor will review this check-in.',
  no_location:'No location was shared, so your instructor will review this check-in.',
  no_anchor:'The room location was not set yet, so your instructor will review this check-in.',
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

export function CheckinClient({intervalSeconds,graceSeconds}:{intervalSeconds:number,graceSeconds:number}){
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
      if(res.ok)return finish({kind:'success',status:data.status,verification:data.verification,location:data.location});
      if(RESCAN[data.code]){rejected.current.add(payload);setNote(RESCAN[data.code]);setScanning(true);return;}
      finish({kind:'stop',code:data.code||'error',message:data.error||'Unable to check in.',retry:res.status>=500||data.code==='bad_location'});
    }catch{finish({kind:'stop',code:'network',message:'No connection to the server. Check your internet and try again.',retry:true});}
    finally{busy.current=false;}
  },[finish]);
  const onOtherCode=useCallback(()=>setNote('That QR code is not an attendance code. Scan the code on your instructor\'s screen.'),[]);
  const onProblem=useCallback((p:ScannerProblem)=>finish({kind:'stop',code:'camera_'+p,message:CAMERA_PROBLEM[p],retry:p==='denied'||p==='failed'}),[finish]);
  function retry(){rejected.current.clear();setOutcome(null);setNote('');setSlow(false);setScanning(true);}

  const best=bestFix(fixes.current,now);
  const noLocation=locState==='denied'||locState==='unsupported'||(slow&&!best);

  return <div className="checkin-wrap"><div className="panel checkin-panel">
    {!outcome&&<>
      <div className="checkin-icon"><Camera size={32}/></div><h2>Scan the code on the screen</h2>
      <p className="muted">Point your camera at the QR code your instructor is showing. Check-in happens as soon as the code is read.</p>
      <div className={'location-line '+(best?(best.accuracy<=150?'good':'weak'):'')} aria-live="polite"><MapPin size={16}/>
        {best?<span>Location ±{Math.round(best.accuracy)} m</span>:locState==='denied'?<span>Location is turned off</span>:locState==='unsupported'?<span>This browser cannot share location</span>:<span>Finding your location…</span>}
      </div>
      {noLocation&&<p className="notice-line">You can still check in without location. Your instructor will review your check-in.</p>}
      <div className="scanner-frame">{scanning?<QrScanner active={scanning} onCode={onCode} onOtherCode={onOtherCode} onProblem={onProblem}/>:<div className="qr-placeholder"><Loader2 size={30} className="spin"/><span>Checking in…</span></div>}</div>
      <p className="scan-note" aria-live="polite">{note}</p>
    </>}
    {outcome?.kind==='success'&&<div className="result-card">
      <div className="result-icon ok"><CheckCircle2 size={40}/></div><h2>You are checked in</h2>
      <div className="chip-row"><StateBadge value={outcome.status}/><StateBadge value={outcome.verification}/></div>
      <p className="muted">{LOCATION_NOTE[outcome.location]||''}</p>
      <Link className="secondary-btn" href="/student">Back to my attendance</Link>
    </div>}
    {outcome?.kind==='stop'&&<div className="result-card">
      <div className={'result-icon '+(outcome.code==='already'?'ok':'warn')}>{outcome.code==='already'?<CheckCircle2 size={40}/>:<AlertTriangle size={40}/>}</div>
      <h2>{outcome.code==='already'?'Already checked in':outcome.code==='qr_closed'?'Check-in is closed':outcome.code.startsWith('camera_')?'Camera not available':'Check-in not recorded'}</h2>
      <p className="muted">{outcome.message}</p>
      <div className="chip-row">{outcome.retry&&<button type="button" className="primary-btn" onClick={retry}><RotateCcw size={16}/> Try again</button>}<Link className="secondary-btn" href="/student">Back to my attendance</Link></div>
    </div>}
  </div>
  <div className="panel explainer-panel"><h3><ShieldCheck size={20}/> How your attendance is protected</h3>
    <div className="explain-point"><b>Codes last {intervalSeconds} seconds</b><p>The code on the screen changes every {intervalSeconds} seconds (plus {graceSeconds} s for slow networks). It holds no link, so a forwarded copy opens nothing.</p></div>
    <div className="explain-point"><b>Scanned inside this website</b><p>Only the live camera can read the code. There is no paste box and no image upload.</p></div>
    <div className="explain-point"><b>Location checked by the server</b><p>The server compares your reading with the room. Far away is refused; unclear readings go to your instructor for review.</p></div>
    <div className="explain-point"><b><MapPin size={16}/> Privacy first</b><p>Your coordinates are not stored, only the distance to the room and the result. Location stops when you leave this page.</p></div>
  </div></div>;
}
