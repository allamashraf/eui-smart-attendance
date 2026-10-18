'use client';
import {useState,type FormEvent} from 'react';
import {ArrowRight,Loader2,Radio} from 'lucide-react';
export function StartSessionForm({classes}:{classes:{id:string,label:string}[]}){
  const[subjectId,setSubjectId]=useState(classes[0]?.id||'');const[title,setTitle]=useState('New lecture');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectId,title})});const d=await r.json();if(!r.ok)throw new Error(d.error);window.location.href=`/instructor/session/${d.id}`;}catch(err){setError(err instanceof Error?err.message:'Unable to start');setBusy(false)}}
  return <form className="form" onSubmit={submit}>
    <div className="field"><label className="label" htmlFor="start-class">Class</label>
      <select id="start-class" className="select" value={subjectId} onChange={e=>setSubjectId(e.target.value)} required>{classes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
    <div className="field"><label className="label" htmlFor="start-title">Session title</label>
      <input id="start-title" className="input" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} required/></div>
    {error&&<div className="alert alert-error" role="alert">{error}</div>}
    <button className="btn btn-accent btn-lg btn-block" disabled={busy||!classes.length}>{busy?<><Loader2 size={18} className="spin" aria-hidden="true"/>Starting…</>:<><Radio size={17} aria-hidden="true"/>Start live session<ArrowRight size={16} className="arrow" aria-hidden="true"/></>}</button>
  </form>;
}
