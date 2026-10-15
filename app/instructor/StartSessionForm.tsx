'use client';
import {useState,type FormEvent} from 'react';
import {Plus,ArrowRight} from 'lucide-react';
export function StartSessionForm({classes}:{classes:{id:string,label:string}[]}){
  const[subjectId,setSubjectId]=useState(classes[0]?.id||'');const[title,setTitle]=useState('New lecture');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectId,title})});const d=await r.json();if(!r.ok)throw new Error(d.error);window.location.href=`/instructor/session/${d.id}`;}catch(err){setError(err instanceof Error?err.message:'Unable to start');setBusy(false)}}
  return <form className="stack-form" onSubmit={submit}><label>Class<select value={subjectId} onChange={e=>setSubjectId(e.target.value)} required>{classes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label>Session title<input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} required/></label>{error&&<p className="error-message">{error}</p>}<button className="primary-btn" disabled={busy||!classes.length}><Plus size={18}/>{busy?'Starting…':'Start live session'}<ArrowRight size={16}/></button></form>
}
