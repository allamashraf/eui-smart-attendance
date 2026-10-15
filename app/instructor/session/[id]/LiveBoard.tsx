'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {RefreshCw,Square,CheckCheck,AlertTriangle} from 'lucide-react';
type Challenge={state:string;qrImage?:string;expiresAt?:string;intervalSeconds?:number;attended?:number;roster_count?:number;error?:string};
export function LiveBoard({sessionId,active,roster}:{sessionId:string,active:boolean,roster:{id:string,label:string}[]}){
  const[info,setInfo]=useState<Challenge|null>(null);const[remaining,setRemaining]=useState(0);const[error,setError]=useState('');const[ended,setEnded]=useState(!active);const[busy,setBusy]=useState(false);
  const[studentId,setStudentId]=useState(roster[0]?.id||'');const[reason,setReason]=useState('Student device unavailable at the start of class.');
  const[message,setMessage]=useState('');
  const fetchChallenge=useCallback(async()=>{try{const r=await fetch(`/api/sessions/${sessionId}/challenge`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setInfo(d);if(d.state==='ended')setEnded(true);setError('');}catch(e){setError(e instanceof Error?e.message:'Failed to load QR');}},[sessionId]);
  useEffect(()=>{if(!active)return;fetchChallenge();const t=setInterval(fetchChallenge,2500);return()=>clearInterval(t)},[active,fetchChallenge]);
  useEffect(()=>{const t=setInterval(()=>setRemaining(info?.expiresAt?Math.max(0,Math.ceil((new Date(info.expiresAt).getTime()-Date.now())/1000)):0),300);return()=>clearInterval(t)},[info?.expiresAt]);
  async function end(){if(!confirm('End this attendance session? Students will no longer be able to check in.'))return;setBusy(true);try{const r=await fetch(`/api/sessions/${sessionId}/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d=await r.json();if(!r.ok)throw new Error(d.error);setEnded(true);window.location.reload();}catch(e){setError(e instanceof Error?e.message:'Unable to close');}finally{setBusy(false)}}
  async function manual(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch(`/api/sessions/${sessionId}/manual`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId,reason})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage('Manual attendance recorded and audited.');setTimeout(()=>window.location.reload(),1100);}catch(e){setMessage(e instanceof Error?e.message:'Failed');}finally{setBusy(false)}}
  return <><div className="qr-box">{ended?<div className="qr-placeholder"><CheckCheck size={36}/><b>Session ended</b><p>Check-ins are closed.</p></div>:info?.qrImage?<img src={info.qrImage} alt="Current rotating attendance QR" width={284} height={284}/>:<div className="qr-placeholder"><RefreshCw size={31}/><span>Loading secure QR…</span></div>}</div>
    {!ended&&<div className="qr-meta"><span><span className="pulse-dot"/> Auto-rotating QR</span><b>{remaining}s</b></div>}
    <p className="micro-note">Students scan this code with the scanner inside the website. It holds no link, so forwarding it opens nothing, and it changes every {info?.intervalSeconds??'few'} seconds. The same QR may be scanned by multiple enrolled students; one attendance record is allowed per student.</p>
    <div className="live-count"><span>Confirmed check-ins</span><b>{info?.attended??'—'} <small>/ {info?.roster_count??roster.length}</small></b></div>
    {error&&<p className="error-message"><AlertTriangle size={16}/> {error}</p>}
    {!ended&&<button className="danger-outline-btn" type="button" onClick={end} disabled={busy}><Square size={15}/> End session</button>}
    {!ended&&<div className="manual-block"><h3>Assisted check-in</h3><p className="muted small">For a dead phone, accessibility issue, or poor signal. Every manual addition needs a reason and is audited.</p><form className="stack-form" onSubmit={manual}><label>Student<select value={studentId} onChange={e=>setStudentId(e.target.value)}>{roster.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Mandatory reason<textarea rows={3} minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>{message&&<p className="form-message">{message}</p>}<button disabled={busy||!roster.length} className="secondary-btn">Record assisted check-in</button></form></div>}
  </>;
}
