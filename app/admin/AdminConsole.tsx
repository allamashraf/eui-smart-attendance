'use client';
import {useState,type FormEvent} from 'react';
import {ArrowRight,Plus,ShieldCheck,UserPlus} from 'lucide-react';
import {StateBadge} from '@/components/Shell';
import {Tip} from '@/components/Tip';
type C={id:string,code:string,title:string,term:string,room:string,instructor:string,enrolled:number};
type Person={id:string,full_name:string,username?:string};
type Alert={id:string,code:string,session:string,rule:string,score:number,description:string,evidence:any,state:string,demo:boolean,student?:string,created:string,outcome?:string,reviewNotes?:string};
type Correction={id:string,student:string,code:string,session:string,reason:string,status:string,created:string};
async function post(path:string,data:Record<string,unknown>){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;}
export function AdminConsole({instructors,students,classes,alerts,corrections}:{instructors:Person[],students:Person[],classes:C[],alerts:Alert[],corrections:Correction[]}){
  const[tab,setTab]=useState<'classes'|'reviews'|'corrections'>('classes');
  const[code,setCode]=useState('CS302'),[title,setTitle]=useState('Demo Software Engineering'),[term,setTerm]=useState('Fall 2026'),[room,setRoom]=useState('Hall C1');
  const[instructorId,setInstructorId]=useState(instructors[0]?.id||''),[studentId,setStudentId]=useState(students[0]?.id||''),[subjectId,setSubjectId]=useState(classes[0]?.id||'');
  const[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ok,setOk]=useState(true);
  const[note,setNote]=useState('Reviewed the synthetic evidence and classroom context.');
  async function submit(e:FormEvent,action:()=>Promise<unknown>){e.preventDefault();setBusy(true);setMessage('');try{await action();setOk(true);setMessage('Saved. Refreshing…');setTimeout(()=>window.location.reload(),750);}catch(err){setOk(false);setMessage(err instanceof Error?err.message:'Unable to save');setBusy(false)}}
  const openAlerts=alerts.filter(a=>a.state==='open').length,pending=corrections.filter(c=>c.status==='pending').length;
  return <>
    <div className="card-head">
      <div className="segmented" role="group" aria-label="Section">
        <button type="button" aria-pressed={tab==='classes'} onClick={()=>setTab('classes')}>Classes</button>
        <button type="button" aria-pressed={tab==='reviews'} onClick={()=>setTab('reviews')}>Review<span className="count">{openAlerts}</span></button>
        <button type="button" aria-pressed={tab==='corrections'} onClick={()=>setTab('corrections')}>Corrections<span className="count">{pending}</span></button>
      </div>
    </div>
    {message&&<div className={ok?'alert alert-ok':'alert alert-error'} role="status" style={{marginBottom:16}}>{message}</div>}

    {tab==='classes'&&<div className="fade-in">
      <div className="grid grid-2">
        <div className="inset"><h3 className="card-title row-wrap" style={{marginBottom:14}}><Plus size={17} aria-hidden="true"/>Add class</h3>
          <form className="form" onSubmit={e=>submit(e,()=>post('/api/admin/classes',{code,title,term,room,instructorId}))}>
            <div className="grid grid-2" style={{gap:12}}>
              <div className="field"><label className="label" htmlFor="ac-code">Code</label><input id="ac-code" className="input" value={code} onChange={e=>setCode(e.target.value)}/></div>
              <div className="field"><label className="label" htmlFor="ac-term">Term</label><input id="ac-term" className="input" value={term} onChange={e=>setTerm(e.target.value)}/></div>
            </div>
            <div className="field"><label className="label" htmlFor="ac-title">Name</label><input id="ac-title" className="input" value={title} onChange={e=>setTitle(e.target.value)}/></div>
            <div className="grid grid-2" style={{gap:12}}>
              <div className="field"><label className="label" htmlFor="ac-room">Room</label><input id="ac-room" className="input" value={room} onChange={e=>setRoom(e.target.value)}/></div>
              <div className="field"><label className="label" htmlFor="ac-inst">Instructor</label><select id="ac-inst" className="select" value={instructorId} onChange={e=>setInstructorId(e.target.value)}>{instructors.map(i=><option key={i.id} value={i.id}>{i.full_name}</option>)}</select></div>
            </div>
            <button className="btn btn-primary" style={{alignSelf:'flex-start'}} disabled={busy||!instructorId}>Create<ArrowRight size={16} className="arrow" aria-hidden="true"/></button>
          </form></div>
        <div className="inset"><h3 className="card-title row-wrap" style={{marginBottom:14}}><UserPlus size={17} aria-hidden="true"/>Enroll student</h3>
          <form className="form" onSubmit={e=>submit(e,()=>post('/api/admin/enrollments',{studentId,subjectId}))}>
            <div className="field"><label className="label" htmlFor="en-student">Student</label><select id="en-student" className="select" value={studentId} onChange={e=>setStudentId(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} ({s.username})</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="en-class">Class</label><select id="en-class" className="select" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>{classes.map(c=><option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></div>
            <button className="btn btn-primary" style={{alignSelf:'flex-start'}} disabled={busy||!subjectId||!studentId}>Enroll<ArrowRight size={16} className="arrow" aria-hidden="true"/></button>
          </form></div>
      </div>
      <h3 className="card-title" style={{margin:'24px 0 8px'}}>Directory</h3>
      <div className="table-wrap"><table className="table" style={{minWidth:620}}>
        <thead><tr><th>Code</th><th>Title</th><th>Term</th><th>Room</th><th>Instructor</th><th className="end">Students</th></tr></thead>
        <tbody>{classes.map(c=><tr key={c.id}><td><b className="mono">{c.code}</b></td><td>{c.title}</td><td className="muted">{c.term}</td><td className="muted">{c.room}</td><td>{c.instructor}</td><td className="end num">{c.enrolled}</td></tr>)}</tbody>
      </table></div>
    </div>}

    {tab==='reviews'&&<div className="grid grid-2 fade-in">{alerts.map(a=><ReviewCard key={a.id} alert={a} busy={busy} note={note} setNote={setNote} submit={(e,outcome)=>submit(e,()=>post(`/api/admin/alerts/${a.id}/review`,{outcome,notes:note}))}/>)}{alerts.length===0&&<p className="empty">No alerts.</p>}</div>}

    {tab==='corrections'&&<div className="grid grid-2 fade-in">{corrections.map(c=><div className="inset stack" style={{gap:10}} key={c.id}>
      <div className="row-wrap" style={{justifyContent:'space-between'}}><b>{c.code} · {c.session}</b><StateBadge value={c.status}/></div>
      <p className="small"><span className="muted">Student</span> · {c.student}</p>
      <p className="small"><span className="muted">Reason</span> · {c.reason}</p>
      <time className="small muted">{c.created}</time>
      {c.status==='pending'&&<form className="form" onSubmit={e=>submit(e,()=>post(`/api/admin/corrections/${c.id}/review`,{outcome:'approved',notes:note}))}>
        <div className="field"><label className="label" htmlFor={`cn-${c.id}`}>Note</label><textarea id={`cn-${c.id}`} className="textarea" minLength={8} value={note} onChange={e=>setNote(e.target.value)} rows={2}/></div>
        <div className="row-wrap"><button className="btn btn-primary btn-sm" disabled={busy} type="submit">Approve</button><button className="btn btn-danger btn-sm" disabled={busy} type="button" onClick={async()=>{setBusy(true);try{await post(`/api/admin/corrections/${c.id}/review`,{outcome:'rejected',notes:note});window.location.reload()}catch(err){setOk(false);setMessage(err instanceof Error?err.message:'Failed');setBusy(false)}}}>Reject</button></div>
      </form>}
    </div>)}{corrections.length===0&&<p className="empty">No requests.</p>}</div>}
  </>;
}
function ReviewCard({alert:a,busy,note,setNote,submit}:{alert:Alert,busy:boolean,note:string,setNote:(s:string)=>void,submit:(e:FormEvent,outcome:string)=>void}){
  const[outcome,setOutcome]=useState('inconclusive');
  return <div className="inset risk">
    <div className="row-wrap" style={{justifyContent:'space-between'}}><span className="row-wrap"><b>{a.code} · {a.session}</b>{a.demo&&<span className="badge plain">Synthetic</span>}</span><StateBadge value={a.state}/></div>
    <div className="risk-score"><span className="row-wrap"><ShieldCheck size={15} aria-hidden="true"/>Priority<Tip text="Possible innocent causes: a shared lab device, a classroom demo, a student helping a classmate. A person must check the evidence."/></span><span><b>{a.score}</b> / 100</span></div>
    <div className="meter" aria-hidden="true"><span style={{width:a.score+'%'}}/></div>
    <p className="small">{a.description}</p>
    <div className="tags"><span className="tag">Rule {a.rule}</span><span className="tag mono">{a.created}</span>{a.student&&<span className="tag">{a.student}</span>}</div>
    {a.state==='open'?<form className="form" onSubmit={e=>submit(e,outcome)}>
      <div className="field"><label className="label" htmlFor={`ro-${a.id}`}>Outcome</label><select id={`ro-${a.id}`} className="select" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="legitimate">Legitimate</option><option value="inconclusive">Inconclusive</option><option value="confirmed">Confirmed</option></select></div>
      <div className="field"><label className="label" htmlFor={`rn-${a.id}`}>Notes</label><textarea id={`rn-${a.id}`} className="textarea" minLength={10} maxLength={1000} rows={2} value={note} onChange={e=>setNote(e.target.value)} required/></div>
      <button type="submit" disabled={busy} className="btn btn-primary" style={{alignSelf:'flex-start'}}>Save review<ArrowRight size={16} className="arrow" aria-hidden="true"/></button>
    </form>:<div className="alert alert-ok"><span><b>Reviewed: {a.outcome}</b> · {a.reviewNotes}</span></div>}
  </div>;
}
