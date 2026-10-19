'use client';
import {useState} from 'react';
import {StateBadge} from '@/components/Shell';
type A={id:string,code:string,session:string,rule:string,score:number,description:string,state:string,demo:boolean,student:string|null,created:string,outcome:string|null,reviewNotes:string|null};
export function InstructorAlertReviews({alerts}:{alerts:A[]}){
 const[busy,setBusy]=useState<string|null>(null);
 const[error,setError]=useState('');
 const[notes,setNotes]=useState<Record<string,string>>({});
 const[outcomes,setOutcomes]=useState<Record<string,string>>({});
 async function review(a:A){
   setBusy(a.id);setError('');
   try {
     const r=await fetch('/api/instructor/alerts/'+a.id+'/review',{method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({outcome:outcomes[a.id]||'inconclusive',notes:notes[a.id]||''})});
     const result=await r.json();
     if(!r.ok)throw new Error(result.error||'Unable to save review');
     window.location.reload();
   }catch(e){setError(e instanceof Error?e.message:'Failed');setBusy(null);}
 }
 return <div className="stack" style={{gap:16}}>
  {error&&<div role="alert" className="alert alert-error">{error}</div>}
  {!alerts.length&&<p className="empty">No alerts for your classes.</p>}
  {alerts.map(a=><div className="inset stack" key={a.id} style={{gap:12}}>
   <div className="row-wrap" style={{justifyContent:'space-between'}}><b>{a.code} · {a.session}</b><StateBadge value={a.state}/></div>
   <p className="small">{a.description}</p>
   <p className="small muted">Rule {a.rule} · Priority {a.score}/100 · {a.created}{a.student?' · '+a.student:''}{a.demo?' · Synthetic demo':''}</p>
   {a.state==='open'?<form className="form" onSubmit={e=>{e.preventDefault();review(a);}}>
     <div className="field"><label className="label" htmlFor={'out-'+a.id}>Review outcome</label>
       <select className="select" id={'out-'+a.id} value={outcomes[a.id]||'inconclusive'} onChange={e=>setOutcomes({...outcomes,[a.id]:e.target.value})}>
         <option value="inconclusive">Inconclusive</option><option value="legitimate">Legitimate</option><option value="confirmed">Confirmed after investigation</option>
       </select></div>
     <div className="field"><label className="label" htmlFor={'notes-'+a.id}>Evidence and review notes</label>
       <textarea className="textarea" id={'notes-'+a.id} minLength={10} maxLength={1000} required rows={2}
         value={notes[a.id]||''} onChange={e=>setNotes({...notes,[a.id]:e.target.value})}/></div>
     <button className="btn btn-primary btn-sm" disabled={!!busy}>Save review</button>
   </form>:<p className="small">Reviewed: {a.outcome} · {a.reviewNotes}</p>}
  </div>)}
 </div>;
}
