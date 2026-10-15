'use client';
import {useState,type FormEvent} from 'react';
import {Send} from 'lucide-react';
export function CorrectionForm({sessions}:{sessions:{id:string,label:string}[]}){
  const[sessionId,setSessionId]=useState(sessions[0]?.id||'');const[reason,setReason]=useState('');const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const res=await fetch('/api/corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,reason})});const d=await res.json();if(!res.ok)throw new Error(d.error);setMessage('Request sent to the administrator.');setReason('');setTimeout(()=>window.location.reload(),1200);}catch(err){setMessage(err instanceof Error?err.message:'Unable to submit');}finally{setBusy(false)}}
  return <form className="stack-form" onSubmit={submit}><label>Session<select value={sessionId} onChange={e=>setSessionId(e.target.value)} required>{sessions.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Reason<textarea rows={3} minLength={10} maxLength={500} placeholder="Explain why your attendance needs correcting…" value={reason} onChange={e=>setReason(e.target.value)} required/></label>{message&&<p className="form-message">{message}</p>}<button className="primary-btn" disabled={busy||!sessions.length}>{busy?'Submitting…':'Submit request'} <Send size={16}/></button></form>
}
