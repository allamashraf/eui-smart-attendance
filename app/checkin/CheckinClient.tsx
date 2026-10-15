'use client';
import {useState,type FormEvent} from 'react';
import {Camera,MapPin,ShieldCheck,CheckCircle2,ArrowRight,AlertTriangle} from 'lucide-react';
export function CheckinClient({initialToken,intervalSeconds,graceSeconds}:{initialToken:string,intervalSeconds:number,graceSeconds:number}){
  const[token,setToken]=useState(initialToken);const[includeLocation,setIncludeLocation]=useState(false);
  const[busy,setBusy]=useState(false);const[result,setResult]=useState<{ok:boolean,message:string}|null>(null);
  function getDevice(){const key='eui-demo-browser-id';let v=localStorage.getItem(key);if(!v){v=crypto.randomUUID();localStorage.setItem(key,v);}return v;}
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setResult(null);
    try{let geo:Record<string,number>={};if(includeLocation){
      if(!navigator.geolocation)throw new Error('Location is not supported on this device. Uncheck location or contact your instructor.');
      const p=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:9000,maximumAge:0}));
      geo={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
    }
    const res=await fetch('/api/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,deviceId:getDevice(),...geo})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Unable to check in.');
    setResult({ok:true,message:`Attendance recorded successfully — ${data.status==='late'?'Late':'Present'}.`});
    }catch(err){setResult({ok:false,message:err instanceof Error?err.message:'Unable to check in.'});}finally{setBusy(false)}
  }
  return <div className="checkin-wrap"><div className="panel checkin-panel"><div className="checkin-icon"><Camera size={32}/></div><h2>Ready to check in?</h2><p className="muted">Your instructor displays a rotating QR code. Open it using your phone camera, or enter the code below. No separate scanner app required.</p><form className="stack-form" onSubmit={submit}><label>Current attendance token<textarea spellCheck={false} rows={3} value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste the live token from your instructor…" required className="token-textarea"/></label><label className="check-row"><input type="checkbox" checked={includeLocation} onChange={e=>setIncludeLocation(e.target.checked)}/><span><b>Share location for this check-in (optional in demo)</b><small>Collected once, not tracked continuously. Demo does not prove campus location.</small></span></label>{result&&<div className={result.ok?'success-message':'error-message'}>{result.ok?<CheckCircle2 size={19}/>:<AlertTriangle size={19}/>} {result.message}</div>}<button type="submit" className="primary-btn full-btn" disabled={busy||!token.trim()}>{busy?'Checking…':'Confirm attendance'} <ArrowRight size={18}/></button></form></div><div className="panel explainer-panel"><h3><ShieldCheck size={20}/> How your attendance is protected</h3><div className="explain-point"><b>{intervalSeconds}-second expiry</b><p>Server-issued QR changes every {intervalSeconds} seconds, with a brief {graceSeconds}-second grace window.</p></div><div className="explain-point"><b>Enrollment checked</b><p>Only students enrolled in the class can check in.</p></div><div className="explain-point"><b>No duplicates</b><p>Each student gets one attendance record per session.</p></div><div className="explain-point"><b><MapPin size={16}/> Privacy first</b><p>Device and location signals support review; they are not proof of misconduct.</p></div></div></div>;
}
