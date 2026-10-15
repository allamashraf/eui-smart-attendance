'use client';
import {useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {RefreshCw,Square,CheckCheck,AlertTriangle,MapPin,Lock,Unlock,MonitorPlay,Search,Users,ScanLine,ShieldQuestion,X} from 'lucide-react';
import {Stat,SectionHeader,StateBadge} from '@/components/Shell';
import {useLiveSession,postJson,type RosterRow} from './useLiveSession';

// Quick-pick chips fill the reason box; the text stays editable. [chip label, text it fills in]
const MANUAL_REASONS=[['No phone','No phone available'],['Dead battery','Dead battery'],['Camera not working','Camera not working'],['Accessibility','Accessibility']];
const REVIEW_REASONS={confirm:['Seen in class','Checked in person'],absent:['Not in the room','Did not answer roll call']};
const LOCATION_TEXT:Record<string,string>={uncertain:'location unclear',no_location:'no location shared',no_anchor:'room location was not set',not_collected:'before Phase 1'};
const time=(iso:string|null)=>iso?new Date(iso).toLocaleTimeString('en-EG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}):'';

// Reads the instructor's position for about 10 s and keeps the most precise reading.
function measureRoom(onProgress:(accuracy:number)=>void):Promise<{lat:number,lon:number,accuracy:number}>{
  return new Promise((resolve,reject)=>{
    if(!('geolocation' in navigator))return reject(new Error('This browser cannot share location.'));
    let best:GeolocationCoordinates|null=null;
    const finish=()=>{navigator.geolocation.clearWatch(watch);clearTimeout(timer);};
    const watch=navigator.geolocation.watchPosition(
      p=>{if(!best||p.coords.accuracy<best.accuracy){best=p.coords;onProgress(best.accuracy);}},
      err=>{if(err.code===err.PERMISSION_DENIED){finish();reject(new Error('Location permission was denied.'));}},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    const timer=setTimeout(()=>{finish();if(best)resolve({lat:best.latitude,lon:best.longitude,accuracy:best.accuracy});
      else reject(new Error('No location reading in 10 seconds. Try again from a phone inside the classroom.'));},10000);
  });
}

// Status chips: "Late" / "Manual" when relevant, plus "Verified" or "Needs review".
function RecordChips({r}:{r:RosterRow}){
  if(!r.status)return <span className="muted small">Not yet</span>;
  return <span className="row-chips">{r.status!=='present'&&<StateBadge value={r.status}/>}{r.verification&&r.verification!=='manual'&&<StateBadge value={r.verification}/>}</span>;
}

export function LiveBoard({sessionId,initiallyActive}:{sessionId:string,initiallyActive:boolean}){
  const {live,challenge,error,setError,remainingMs,refresh}=useLiveSession(sessionId,initiallyActive);
  const[busy,setBusy]=useState(false);
  const[measuring,setMeasuring]=useState<number|null|'started'>(null);
  // assisted check-in
  const[search,setSearch]=useState('');const[picked,setPicked]=useState<RosterRow|null>(null);
  const[reason,setReason]=useState('');const[message,setMessage]=useState('');
  // review
  const[filter,setFilter]=useState<'all'|'review'|'missing'>('all');
  const[reviewing,setReviewing]=useState<{id:string,action:'confirm'|'absent'}|null>(null);
  const[reviewReason,setReviewReason]=useState('');

  const ended=live?live.state==='ended':!initiallyActive;
  const qrClosed=!ended&&challenge?.state==='qr_closed';
  const roster=live?.roster??[];
  const counts=live?.counts;

  async function act(run:()=>Promise<unknown>){setBusy(true);setError('');try{await run();refresh();}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}
  const toggleQr=()=>act(()=>postJson(`/api/sessions/${sessionId}/qr`,{open:qrClosed}));
  const end=()=>{if(confirm('End this session? Scanning and assisted check-in stop. Later fixes go through correction requests.'))act(()=>postJson(`/api/sessions/${sessionId}/close`,{}));};
  async function setRoom(){
    setMeasuring('started');setError('');
    try{const r=await measureRoom(a=>setMeasuring(a));await postJson(`/api/sessions/${sessionId}/anchor`,r);refresh();}
    catch(e){setError(e instanceof Error?e.message:'Could not set the room location.');}
    finally{setMeasuring(null);}
  }

  // Search by name or student number, among students without a record only.
  const matches=useMemo(()=>{
    const q=search.trim().toLowerCase();if(!q)return [];
    return roster.filter(r=>!r.status&&(r.name.toLowerCase().includes(q)||(r.number||'').toLowerCase().includes(q))).slice(0,6);
  },[search,roster]);
  async function addManual(e:FormEvent){
    e.preventDefault();if(!picked)return;setBusy(true);setMessage('');
    try{await postJson(`/api/sessions/${sessionId}/manual`,{studentId:picked.id,reason});
      setMessage(`${picked.name} was added and the action was audited.`);setPicked(null);setSearch('');setReason('');refresh();}
    catch(err){setMessage(err instanceof Error?err.message:'Failed');}finally{setBusy(false);}
  }
  async function submitReview(e:FormEvent){
    e.preventDefault();if(!reviewing)return;
    await act(()=>postJson(`/api/sessions/${sessionId}/review`,{studentId:reviewing.id,action:reviewing.action,reason:reviewReason}));
    setReviewing(null);setReviewReason('');
  }
  const shown=roster.filter(r=>filter==='all'||(filter==='review'?r.verification==='needs_review':!r.status));
  const seconds=Math.ceil(remainingMs/1000);

  return <>
    <div className="stats-grid three-cols">
      <Stat label="Total students" value={counts?.roster??'—'} note="Enrolled in this class" Icon={Users}/>
      <Stat label="Checked in" value={counts?.attended??'—'} note="Updates every 2 seconds" Icon={ScanLine}/>
      <Stat label="Needs review" value={counts?.needsReview??'—'} note="Confirm or mark absent" Icon={ShieldQuestion}/>
    </div>
    <div className="content-grid session-grid">
      <section className="panel">
        <SectionHeader title="Live attendance QR" note={challenge?.intervalSeconds?`Server-issued · changes every ${challenge.intervalSeconds} seconds`:'Server-issued'} aside={<StateBadge value={ended?'ended':qrClosed?'qr_closed':'active'}/>}/>
        {!ended&&(measuring!==null?<div className="anchor-bar"><MapPin size={16}/> Measuring room location… {typeof measuring==='number'&&`±${Math.round(measuring)} m`}</div>
          :live?.anchor?<div className="anchor-bar good"><MapPin size={16}/> Room location set (±{Math.round(live.anchor.accuracyM)} m) · <button type="button" className="link-btn" onClick={setRoom} disabled={busy}>Update</button></div>
          :live&&<div className="notice-line anchor-missing"><span><b>Without room location, every check-in goes to review.</b> Set it from a phone inside the classroom.</span><button type="button" className="secondary-btn" onClick={setRoom} disabled={busy}><MapPin size={15}/> Set room location</button></div>)}
        <div className="qr-box">{ended?<div className="qr-placeholder"><CheckCheck size={36}/><b>Session ended</b><p>Scanning and assisted check-in are closed.</p></div>
          :qrClosed?<div className="qr-placeholder"><Lock size={34}/><b>QR closed</b><p>Students cannot scan. You can still add students below.</p></div>
          :challenge?.qrImage?<img src={challenge.qrImage} alt="Current rotating attendance QR" width={284} height={284}/>
          :<div className="qr-placeholder"><RefreshCw size={31}/><span>Loading secure QR…</span></div>}</div>
        {!ended&&!qrClosed&&<div className="qr-meta"><span><span className="pulse-dot"/> Auto-rotating QR</span><b>{seconds}s</b></div>}
        <p className="micro-note">Students scan this code with the scanner inside the website. It holds no link, so forwarding it opens nothing. One attendance record is allowed per student.</p>
        {error&&<p className="error-message"><AlertTriangle size={16}/> {error}</p>}
        {!ended&&<div className="board-controls">
          <button type="button" className="secondary-btn" onClick={toggleQr} disabled={busy||!challenge}>{qrClosed?<><Unlock size={15}/> Reopen QR</>:<><Lock size={15}/> Close QR</>}</button>
          <Link className="secondary-btn" href={`/instructor/session/${sessionId}/present`} target="_blank"><MonitorPlay size={15}/> Open projector view</Link>
          <button type="button" className="danger-outline-btn" onClick={end} disabled={busy}><Square size={15}/> End session</button>
        </div>}
        {!ended&&<div className="manual-block"><h3>Assisted check-in</h3>
          <p className="muted small">For a student without a working phone. Works with the QR open or closed. Every addition needs a reason and is audited.</p>
          <form className="stack-form" onSubmit={addManual}>
            {picked?<div className="picked-student"><span><b>{picked.name}</b><small>{picked.number||'No student number'}</small></span><button type="button" className="link-btn" onClick={()=>setPicked(null)} aria-label="Choose another student"><X size={16}/></button></div>
              :<label>Find student<span className="search-field"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or student number" autoComplete="off"/></span>
                {search.trim()&&<span className="search-results">{matches.map(m=><button type="button" key={m.id} className="search-item" onClick={()=>{setPicked(m);setSearch('');}}><b>{m.name}</b><small>{m.number||'No student number'}</small></button>)}
                  {!matches.length&&<span className="muted small">No student without a record matches “{search.trim()}”.</span>}</span>}</label>}
            <label>Reason (required)<textarea rows={2} minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why is this student added by hand?" required/></label>
            <div className="reason-chips">{MANUAL_REASONS.map(([label,text])=><button type="button" key={label} className="chip-btn" onClick={()=>setReason(text)}>{label}</button>)}</div>
            {message&&<p className="form-message">{message}</p>}
            <button disabled={busy||!picked||reason.trim().length<10} className="secondary-btn">Record assisted check-in</button>
          </form></div>}
      </section>
      <section className="panel">
        <SectionHeader title="Student roster" note="Live · updates every 2 seconds"/>
        <div className="tab-list">{([['all','All'],['review',`Needs review (${counts?.needsReview??0})`],['missing',`Not checked in (${counts?counts.roster-counts.attended:0})`]] as const).map(([k,label])=>
          <button type="button" key={k} className={filter===k?'tab active':'tab'} onClick={()=>setFilter(k)}>{label}</button>)}</div>
        <div className="roster-list">{shown.map(r=><div className="roster-row" key={r.id}>
          <div className="simple-row"><span><b>{r.name}</b><small>{r.number||'Demo student'}{r.checkedInAt?` · ${time(r.checkedInAt)}`:''}{r.verification==='needs_review'&&r.location?` · ${LOCATION_TEXT[r.location]||r.location}${r.distanceM!=null?`, ${Math.round(r.distanceM)} m from room`:''}`:''}</small></span><RecordChips r={r}/></div>
          {r.status&&reviewing?.id!==r.id&&<div className="roster-actions">
            {r.verification==='needs_review'&&<button type="button" className="link-btn" onClick={()=>{setReviewing({id:r.id,action:'confirm'});setReviewReason('');}}>Confirm</button>}
            <button type="button" className="link-btn danger" onClick={()=>{setReviewing({id:r.id,action:'absent'});setReviewReason('');}}>Mark absent</button></div>}
          {reviewing?.id===r.id&&<form className="review-form" onSubmit={submitReview}>
            <label>{reviewing.action==='confirm'?'Why are you confirming this check-in?':'Why is this student absent? (removes the record)'}
              <input value={reviewReason} onChange={e=>setReviewReason(e.target.value)} minLength={10} maxLength={500} required placeholder="Reason (at least 10 characters)"/></label>
            <div className="reason-chips">{REVIEW_REASONS[reviewing.action].map(t=><button type="button" key={t} className="chip-btn" onClick={()=>setReviewReason(t)}>{t}</button>)}</div>
            <div className="review-buttons"><button className={reviewing.action==='confirm'?'primary-btn':'danger-outline-btn'} disabled={busy||reviewReason.trim().length<10}>{reviewing.action==='confirm'?'Confirm':'Mark absent'}</button>
              <button type="button" className="link-btn" onClick={()=>setReviewing(null)}>Cancel</button></div>
          </form>}
        </div>)}
        {live&&!shown.length&&<p className="muted small">No students in this list.</p>}
        {!live&&<p className="muted small">Loading roster…</p>}</div>
      </section>
    </div>
  </>;
}
