'use client';
import {useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {AlertTriangle,CheckCheck,Loader2,Lock,MapPin,MonitorPlay,RefreshCw,Search,Square,Unlock,X} from 'lucide-react';
import {SectionHeader,StateBadge} from '@/components/Shell';
import {CountUp} from '@/components/CountUp';
import {useLiveSession,postJson,type RosterRow} from './useLiveSession';
import {pureBlackQr} from './pureBlackQr';

// Quick-pick chips fill the reason box; the text stays editable. [chip label, text it fills in]
const MANUAL_REASONS=[['No phone','No phone available'],['Dead battery','Dead battery'],['Camera not working','Camera not working'],['Accessibility','Accessibility']];
const REVIEW_REASONS={confirm:['Seen in class','Checked in person'],absent:['Not in the room','Did not answer roll call']};
const LOCATION_TEXT:Record<string,string>={uncertain:'Location unclear',no_location:'No location shared',no_anchor:'Room location was not set',not_collected:'Before Phase 1'};
const time=(iso:string|null)=>iso?new Date(iso).toLocaleTimeString('en-EG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}):'';
const RING_R=47.5,RING_C=2*Math.PI*RING_R; // countdown ring, in the ring's own 100×100 units

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
      else reject(new Error('No location in 10 s. Try from a phone in the room.'));},10000);
  });
}

// Status chips: "Late" / "Manual" when relevant, plus "Verified" or "Needs review".
function RecordChips({r}:{r:RosterRow}){
  if(!r.status)return <span className="muted small">Not yet</span>;
  return <span className="row-wrap" style={{justifyContent:'flex-end'}}>{r.status!=='present'&&<StateBadge value={r.status}/>}{r.verification&&r.verification!=='manual'&&<StateBadge value={r.verification}/>}</span>;
}

type Reviewing={id:string,action:'confirm'|'absent',where:'review'|'roster'};

export function LiveBoard({sessionId,initiallyActive}:{sessionId:string,initiallyActive:boolean}){
  const {live,challenge,error,setError,remainingMs,refresh}=useLiveSession(sessionId,initiallyActive);
  const[busy,setBusy]=useState(false);
  const[measuring,setMeasuring]=useState<number|null|'started'>(null);
  // assisted check-in
  const[search,setSearch]=useState('');const[picked,setPicked]=useState<RosterRow|null>(null);
  const[reason,setReason]=useState('');const[message,setMessage]=useState('');const[messageOk,setMessageOk]=useState(true);
  // review
  const[filter,setFilter]=useState<'all'|'review'|'missing'>('all');
  const[reviewing,setReviewing]=useState<Reviewing|null>(null);
  const[reviewReason,setReviewReason]=useState('');

  const ended=live?live.state==='ended':!initiallyActive;
  const qrClosed=!ended&&challenge?.state==='qr_closed';
  const roster=live?.roster??[];
  const counts=live?.counts;
  const qrSrc=useMemo(()=>pureBlackQr(challenge?.qrImage),[challenge?.qrImage]);

  async function act(run:()=>Promise<unknown>){setBusy(true);setError('');try{await run();refresh();}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}
  const toggleQr=()=>act(()=>postJson(`/api/sessions/${sessionId}/qr`,{open:qrClosed}));
  const end=()=>{if(confirm('End this session? Scanning stops.'))act(()=>postJson(`/api/sessions/${sessionId}/close`,{}));};
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
      setMessageOk(true);setMessage(`${picked.name} added.`);setPicked(null);setSearch('');setReason('');refresh();}
    catch(err){setMessageOk(false);setMessage(err instanceof Error?err.message:'Failed');}finally{setBusy(false);}
  }
  async function submitReview(e:FormEvent){
    e.preventDefault();if(!reviewing)return;
    await act(()=>postJson(`/api/sessions/${sessionId}/review`,{studentId:reviewing.id,action:reviewing.action,reason:reviewReason}));
    setReviewing(null);setReviewReason('');
  }
  const startReview=(id:string,action:'confirm'|'absent',where:'review'|'roster')=>{setReviewing({id,action,where});setReviewReason('');};

  const shown=roster.filter(r=>filter==='all'||(filter==='review'?r.verification==='needs_review':!r.status));
  const pending=roster.filter(r=>r.verification==='needs_review');
  const verified=roster.filter(r=>r.verification==='verified').length;
  const manual=roster.filter(r=>r.verification==='manual').length;
  const late=roster.filter(r=>r.status==='late').length;
  const notYet=counts?counts.roster-counts.attended:0;
  const total=challenge?.intervalSeconds?challenge.intervalSeconds*1000:8000;
  const fraction=Math.min(1,remainingMs/total);
  const seconds=Math.ceil(remainingMs/1000);

  const reviewForm=(r:RosterRow)=>reviewing?.id===r.id&&<form className="review-form" onSubmit={submitReview}>
    <div className="field"><label className="label" htmlFor={`rv-${r.id}`}>{reviewing.action==='confirm'?'Reason':'Reason · removes the record'}</label>
      <input id={`rv-${r.id}`} className="input" value={reviewReason} onChange={e=>setReviewReason(e.target.value)} minLength={10} maxLength={500} required placeholder="At least 10 characters" autoFocus/></div>
    <div className="chips">{REVIEW_REASONS[reviewing.action].map(t=><button type="button" key={t} className="chip" onClick={()=>setReviewReason(t)}>{t}</button>)}</div>
    <div className="row-wrap"><button className={reviewing.action==='confirm'?'btn btn-primary btn-sm':'btn btn-danger btn-sm'} disabled={busy||reviewReason.trim().length<10}>{reviewing.action==='confirm'?'Confirm':'Mark absent'}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setReviewing(null)}>Cancel</button></div>
  </form>;

  return <>
    <div className="board-bar reveal">
      <div className="board-status">
        <StateBadge value={ended?'ended':qrClosed?'qr_closed':'active'}/>
        {!ended&&<span className="row-wrap"><span className="live-dot"/>Live</span>}
      </div>
      {!ended&&<div className="row-wrap">
        <Link className="btn btn-secondary" href={`/instructor/session/${sessionId}/present`} target="_blank"><MonitorPlay size={16} aria-hidden="true"/>Projector</Link>
        <button type="button" className="btn btn-secondary" onClick={toggleQr} disabled={busy||!challenge}>{qrClosed?<><Unlock size={16} aria-hidden="true"/>Reopen QR</>:<><Lock size={16} aria-hidden="true"/>Close QR</>}</button>
        <button type="button" className="btn btn-danger" onClick={end} disabled={busy}><Square size={14} aria-hidden="true"/>End</button>
      </div>}
    </div>
    {error&&<div className="alert alert-error" role="alert" style={{marginBottom:16}}><AlertTriangle size={16} aria-hidden="true"/><span>{error}</span></div>}

    <div className="board">
      {/* No entrance animation on this card: the QR must never fade, move or scale. */}
      <section className="card qr-card" aria-label="Live attendance QR">
        <div className="qr-stage">
          {!ended&&!qrClosed&&challenge?.qrImage&&<svg className="qr-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="track" cx="50" cy="50" r={RING_R} strokeWidth="2.4"/>
            <circle className="fill" cx="50" cy="50" r={RING_R} strokeWidth="2.4" strokeDasharray={RING_C} strokeDashoffset={RING_C*(1-fraction)}/>
          </svg>}
          {ended?<div className="qr-empty"><CheckCheck size={30} aria-hidden="true"/><b>Session ended</b></div>
            :qrClosed?<div className="qr-empty"><Lock size={28} aria-hidden="true"/><b>QR closed</b></div>
            :qrSrc?<div className="qr-frame"><img className="qr-img" src={qrSrc} alt="Current rotating attendance QR" width={240} height={240}/></div>
            :<div className="qr-empty"><RefreshCw size={26} className="spin" aria-hidden="true"/><span>Loading…</span></div>}
        </div>
        {!ended&&!qrClosed&&<div className="qr-caption" aria-live="off">
          <b>Next code in <span className="num">{seconds} s</span></b>
        </div>}
        {!ended&&(measuring!==null?<div className="anchor"><span><Loader2 size={16} className="spin" aria-hidden="true"/>Measuring… {typeof measuring==='number'&&<span className="num">±{Math.round(measuring)} m</span>}</span></div>
          :live?.anchor?<div className="anchor good"><span><MapPin size={16} aria-hidden="true"/>Room <span className="num">±{Math.round(live.anchor.accuracyM)} m</span></span><button type="button" className="link" onClick={setRoom} disabled={busy}>Update</button></div>
          :live&&<div className="alert alert-warn" style={{flexDirection:'column',gap:10}}><span>No room location · check-ins go to review</span><button type="button" className="btn btn-secondary btn-sm" onClick={setRoom} disabled={busy}><MapPin size={15} aria-hidden="true"/>Set location</button></div>)}
      </section>

      <div className="board-main">
        <section className="card count-card reveal" style={{'--i':1} as React.CSSProperties} aria-label="Check-in count">
          {live?<>
            <div className="count-big"><CountUp value={counts!.attended} className=""/><span>of <span className="num">{counts!.roster}</span> checked in{late?<> · <span className="num">{late}</span> late</>:null}</span></div>
            <div className="stackbar" aria-hidden="true">
              <span className="sw-verified" style={{flexGrow:verified}}/>
              <span className="sw-review" style={{flexGrow:counts!.needsReview}}/>
              <span className="sw-manual" style={{flexGrow:manual}}/>
              <span className="sw-none" style={{flexGrow:Math.max(notYet,0)||(counts!.attended?0:1)}}/>
            </div>
            <div className="legend">
              <span><i className="sw-verified"/>Verified <b>{verified}</b></span>
              <span><i className="sw-review"/>Needs review <b>{counts!.needsReview}</b></span>
              <span><i className="sw-manual"/>Manual <b>{manual}</b></span>
              <span><i className="sw-none"/>Not yet <b>{notYet}</b></span>
            </div>
          </>:<><div className="skeleton" style={{height:64,width:'60%'}}/><div className="skeleton" style={{height:12}}/><div className="skeleton" style={{height:18,width:'80%'}}/></>}
        </section>

        <div className="grid grid-2">
          <section className="card card-pad reveal" style={{'--i':2} as React.CSSProperties} aria-label="Live feed">
            <SectionHeader title="Live feed"/>
            <div className="rows">{(live?.recent??[]).map(r=><div className="row feed-item" key={r.name+r.checkedInAt}>
              <span className="row-main"><span className="row-title">{r.name}</span><time className="row-sub">{time(r.checkedInAt)}</time></span>
              <span className="row-end">{r.status==='late'&&<StateBadge value="late"/>}<StateBadge value={r.verification==='manual'?'manual':r.verification}/></span>
            </div>)}</div>
            {live&&!live.recent.length&&<p className="empty">No check-ins yet.</p>}
            {!live&&<div className="stack" style={{gap:10}}>{[0,1,2].map(i=><div key={i} className="skeleton" style={{height:20}}/>)}</div>}
          </section>

          <section className="card card-pad reveal" style={{'--i':3} as React.CSSProperties} aria-label="Needs review">
            <SectionHeader title="Needs review" aside={pending.length?<span className="badge badge-needs_review plain num">{pending.length}</span>:undefined}/>
            <div className="stack" style={{gap:10}}>{pending.map(r=><div className="review-item" key={r.id}>
              <div className="top"><span className="row-title">{r.name}</span><time className="small muted">{time(r.checkedInAt)}</time></div>
              <span className="why">{LOCATION_TEXT[r.location??'']||r.location||'Needs a check'}{r.distanceM!=null?<> · <span className="num">{Math.round(r.distanceM)} m</span> from room</>:null}</span>
              {reviewing?.id===r.id&&reviewing.where==='review'?reviewForm(r):<div className="review-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={()=>startReview(r.id,'confirm','review')}>Confirm</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={()=>startReview(r.id,'absent','review')}>Mark absent</button>
              </div>}
            </div>)}</div>
            {live&&!pending.length&&<p className="empty">Nothing to review.</p>}
          </section>
        </div>

        {!ended&&<section className="card card-pad reveal" style={{'--i':4} as React.CSSProperties} aria-labelledby="assist-title">
          <div className="card-head"><h2 className="card-title" id="assist-title">Assisted check-in</h2></div>
          <form className="form" onSubmit={addManual}>
            {picked?<div className="picked"><span className="row-main"><span className="row-title">{picked.name}</span><span className="row-sub mono">{picked.number||'No student number'}</span></span><button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={()=>setPicked(null)} aria-label="Choose another student"><X size={16}/></button></div>
              :<div className="field"><label className="label" htmlFor="assist-find">Student</label>
                <div className="input-wrap"><Search size={16} aria-hidden="true"/><input id="assist-find" className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or student number" autoComplete="off"/></div>
                {search.trim()&&<div className="results">{matches.map(m=><button type="button" key={m.id} className="result-btn" onClick={()=>{setPicked(m);setSearch('');}}><b>{m.name}</b><span className="mono small muted">{m.number||'No student number'}</span></button>)}
                  {!matches.length&&<span className="hint">No match</span>}</div>}</div>}
            <div className="field"><label className="label" htmlFor="assist-reason">Reason</label>
              <textarea id="assist-reason" className="textarea" rows={2} minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters" required/></div>
            <div className="chips">{MANUAL_REASONS.map(([label,text])=><button type="button" key={label} className="chip" onClick={()=>setReason(text)}>{label}</button>)}</div>
            {message&&<div className={messageOk?'alert alert-ok':'alert alert-error'} role="status">{message}</div>}
            <button className="btn btn-primary" style={{alignSelf:'flex-start'}} disabled={busy||!picked||reason.trim().length<10}>Add student</button>
          </form>
        </section>}

        <section className="card card-pad reveal" style={{'--i':5} as React.CSSProperties} aria-labelledby="roster-title">
          <div className="card-head" style={{flexWrap:'wrap'}}>
            <h2 className="card-title" id="roster-title">Roster</h2>
            <div className="segmented" role="group" aria-label="Filter the roster">
              {([['all','All',counts?.roster],['review','Review',counts?.needsReview],['missing','Not yet',notYet]] as const).map(([k,label,n])=>
                <button type="button" key={k} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{label}{n!=null&&<span className="count">{n}</span>}</button>)}
            </div>
          </div>
          <div className="rows roster">{shown.map(r=><div key={r.id}>
            <div className="row">
              <span className="row-main"><span className="row-title">{r.name}</span>
                <span className="row-sub"><span className="mono">{r.number||'Demo student'}</span>{r.checkedInAt?<> · <time>{time(r.checkedInAt)}</time></>:null}{r.verification==='needs_review'&&r.location?` · ${LOCATION_TEXT[r.location]||r.location}`:''}</span></span>
              <span className="row-end"><RecordChips r={r}/>
                {r.status&&reviewing?.id!==r.id&&<span className="row-wrap">
                  {r.verification==='needs_review'&&<button type="button" className="link" onClick={()=>startReview(r.id,'confirm','roster')}>Confirm</button>}
                  <button type="button" className="link link-danger" onClick={()=>startReview(r.id,'absent','roster')}>Mark absent</button></span>}
              </span>
            </div>
            {reviewing?.where==='roster'&&reviewForm(r)}
          </div>)}</div>
          {live&&!shown.length&&<p className="empty">No students here.</p>}
          {!live&&<div className="stack" style={{gap:12}}>{[0,1,2,3].map(i=><div key={i} className="skeleton" style={{height:22}}/>)}</div>}
        </section>
      </div>
    </div>
  </>;
}
