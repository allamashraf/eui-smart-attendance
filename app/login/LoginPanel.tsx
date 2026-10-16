'use client';
import {useState,type FormEvent} from 'react';
import {Activity,ArrowRight,LockKeyhole,Shield,Users,GraduationCap,Eye,EyeOff} from 'lucide-react';
export function LoginPanel({nextPath}:{nextPath:string}){
  const [username,setUsername]=useState('motaz');const[password,setPassword]=useState('EUI-Demo-2026!');
  const[show,setShow]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function onSubmit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Sign in failed');window.location.href=(data.to==='/student' && nextPath==='/checkin')?nextPath:data.to;
  }catch(err){setError(err instanceof Error?err.message:'Sign in failed');setBusy(false);}}
  return <div className="login-layout">
    <div className="login-story"><div className="login-brand"><div className="brand-mark"><Activity size={29}/></div><div><b>EUI SMART ATTENDANCE</b><span>Intelligent attendance, accountable decisions.</span></div></div><div className="story-main"><p className="story-kicker">THE NEXT GENERATION OF CLASSROOM ATTENDANCE</p><h1>A smarter way<br/>to <em>show up.</em></h1><p>One platform for secure check-ins, real-time classroom management, and explainable attendance insights.</p><div className="story-features"><div><Shield size={20}/><span>Rotating secure QR</span></div><div><Users size={20}/><span>Enrollment verification</span></div><div><GraduationCap size={20}/><span>Clear attendance history</span></div></div></div><p className="story-bottom">Egypt University of Informatics · Student-built project</p></div>
    <div className="login-right"><div className="login-card"><span className="login-label"><LockKeyhole size={16}/> TEMPORARY DEMO SIGN-IN</span><h2>Welcome back</h2><p className="muted">Sign in with the demonstration account while university Microsoft approval is pending.</p><div className="notice"><b>Not Microsoft SSO yet</b><span>These usernames and passwords are synthetic. No university credentials should be entered here.</span></div>
      <form onSubmit={onSubmit}><label htmlFor="uname">Username</label><input id="uname" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/><label htmlFor="pass">Password</label><div className="password-field"><input id="pass" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{error&&<div className="error-message">{error}</div>}<button type="submit" disabled={busy} className="primary-btn full-btn">{busy?'Signing in…':'Sign in to dashboard'} <ArrowRight size={18}/></button></form>
      <div className="demo-account-title">TRY A DEMO ROLE</div><div className="demo-roles">{[['motaz','Student'],['instructor','Instructor'],['admin','Administrator']].map(([u,role])=><button key={u} type="button" className={username===u?'role-option chosen':'role-option'} onClick={()=>{setUsername(u);setPassword('EUI-Demo-2026!');setError('')}}><b>{role}</b><small>{u}</small></button>)}</div><p className="login-footnote">Demo password: <code>EUI-Demo-2026!</code> · Change this before any shared deployment.</p>
    </div></div>
  </div>;
}
