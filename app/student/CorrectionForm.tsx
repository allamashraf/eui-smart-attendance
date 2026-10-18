'use client';
import {useState,type FormEvent} from 'react';
import {Loader2,Send} from 'lucide-react';
export function CorrectionForm({sessions}:{sessions:{id:string,label:string}[]}){
  const[sessionId,setSessionId]=useState(sessions[0]?.id||'');const[reason,setReason]=useState('');const[message,setMessage]=useState('');const[ok,setOk]=useState(false);const[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const res=await fetch('/api/corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,reason})});const d=await res.json();if(!res.ok)throw new Error(d.error);setOk(true);setMessage('Request sent to the administrator.');setReason('');setTimeout(()=>window.location.reload(),1200);}catch(err){setOk(false);setMessage(err instanceof Error?err.message:'Unable to submit');}finally{setBusy(false)}}
  return <form className="form" onSubmit={submit}>
    <div className="field"><label className="label" htmlFor="corr-session">Session</label>
      <select id="corr-session" className="select" value={sessionId} onChange={e=>setSessionId(e.target.value)} required>{sessions.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
    <div className="field"><label className="label" htmlFor="corr-reason">Reason</label>
      <textarea id="corr-reason" className="textarea" rows={3} minLength={10} maxLength={500} placeholder="Explain why your attendance needs correcting…" value={reason} onChange={e=>setReason(e.target.value)} required/>
      <span className="hint">At least 10 characters.</span></div>
    {message&&<div className={ok?'alert alert-ok':'alert alert-error'} role="status">{message}</div>}
    <button className="btn btn-primary" style={{alignSelf:'flex-start'}} disabled={busy||!sessions.length}>{busy?<><Loader2 size={16} className="spin" aria-hidden="true"/>Submitting…</>:<>Submit request<Send size={15} aria-hidden="true"/></>}</button>
  </form>;
}
