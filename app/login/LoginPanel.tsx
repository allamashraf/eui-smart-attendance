'use client';
import {useState,type FormEvent} from 'react';
import {ArrowRight,Eye,EyeOff,Loader2,LockKeyhole,MapPin,ScanLine,ShieldCheck,AlertTriangle,User} from 'lucide-react';
import {BrandMark} from '@/components/Shell';

const ROLES=[['motaz','Student'],['instructor','Instructor'],['admin','Admin']] as const;

export function LoginPanel({nextPath}:{nextPath:string}){
  const [username,setUsername]=useState('motaz');const[password,setPassword]=useState('');
  const[show,setShow]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function onSubmit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Sign in failed');window.location.href=(data.to==='/student' && nextPath==='/checkin')?nextPath:data.to;
  }catch(err){setError(err instanceof Error?err.message:'Sign in failed');setBusy(false);}}

  return <div className="auth">
    <aside className="auth-story">
      <div className="auth-brand"><BrandMark size={30}/><span>EUI Attendance</span></div>
      {/* Decorative scan visual: rings pulse outwards and a soft sweep turns. Hidden from screen readers. */}
      <div className="auth-visual" aria-hidden="true">
        <div className="sweep"/>
        <svg viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="188" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1"/>
          <circle cx="200" cy="200" r="138" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1" strokeDasharray="2 6"/>
          <circle cx="200" cy="200" r="88" fill="none" stroke="rgba(95,211,188,.35)" strokeWidth="1.2"/>
          <circle className="ring-pulse" cx="200" cy="200" r="150" fill="none" stroke="rgba(95,211,188,.55)" strokeWidth="1.5"/>
          <circle className="ring-pulse d2" cx="200" cy="200" r="150" fill="none" stroke="rgba(95,211,188,.55)" strokeWidth="1.5"/>
          <circle cx="200" cy="200" r="40" fill="rgba(95,211,188,.12)" stroke="#5FD3BC" strokeWidth="1.5"/>
          <circle cx="200" cy="200" r="7" fill="#5FD3BC"/>
          <circle cx="252" cy="168" r="9" fill="#FFFFFF" stroke="#0E1113" strokeWidth="3"/>
        </svg>
      </div>
      <div className="auth-copy">
        <span className="eyebrow eyebrow-light"><span className="live-dot mint"/>Smart attendance</span>
        <h1>Attendance that can’t be forwarded.</h1>
        <p>Signed codes that change every few seconds, scanned inside the website, with the location checked on the server.</p>
        <ul className="auth-points">
          <li><ScanLine size={18} aria-hidden="true"/>Rotating signed QR. No link to share.</li>
          <li><MapPin size={18} aria-hidden="true"/>Location compared with the room by the server.</li>
          <li><ShieldCheck size={18} aria-hidden="true"/>Every manual change needs a reason and is audited.</li>
        </ul>
      </div>
      <p className="auth-foot">Student project prototype · Not an official EUI system · Synthetic data only</p>
    </aside>

    <main className="auth-main">
      <div className="auth-card reveal">
        <span className="badge plain" style={{alignSelf:'flex-start'}}><LockKeyhole size={13} aria-hidden="true"/>Demo sign-in</span>
        <div>
          <h2>Welcome back</h2>
          <p className="muted" style={{marginTop:8}}>Sign in with a demonstration account. Microsoft sign-in is waiting for university approval.</p>
        </div>
        <div className="segmented role-switch" role="group" aria-label="Choose a demo account">
          {ROLES.map(([u,role])=><button key={u} type="button" aria-pressed={username===u} onClick={()=>{setUsername(u);setPassword('');setError('')}}>{role}</button>)}
        </div>
        <form className="form" onSubmit={onSubmit}>
          <div className="field"><label className="label" htmlFor="uname">Username</label>
            <div className="input-wrap"><User size={16} aria-hidden="true"/><input className="input" id="uname" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></div></div>
          <div className="field"><label className="label" htmlFor="pass">Password</label>
            <div className="input-wrap"><LockKeyhole size={16} aria-hidden="true"/><input className="input" id="pass" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required style={{paddingRight:48}}/>
              <button type="button" className="btn btn-ghost btn-sm btn-icon input-action" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>
          {error&&<div className="alert alert-error" role="alert"><AlertTriangle size={16} aria-hidden="true"/><span>{error}</span></div>}
          <button type="submit" disabled={busy} className="btn btn-primary btn-lg btn-block">{busy?<><Loader2 size={18} className="spin" aria-hidden="true"/>Signing in…</>:<>Sign in<ArrowRight size={18} className="arrow" aria-hidden="true"/></>}</button>
        </form>
        <div className="alert alert-warn"><ShieldCheck size={16} aria-hidden="true"/><span><b>Not Microsoft SSO.</b> These accounts are synthetic. Never enter your university password here.</span></div>
        <p className="auth-help">Ask the project team for the demo password.</p>
      </div>
    </main>
  </div>;
}
