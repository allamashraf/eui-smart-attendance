import Link from 'next/link';
import {Activity, BookOpen, ShieldCheck, GraduationCap, Radio, LayoutDashboard, ClipboardCheck, Database, type LucideIcon} from 'lucide-react';
import type {AppUser} from '@/lib/auth';
import {LogoutButton} from './LogoutButton';
const menus:Record<AppUser['role'], {url:string,label:string,Icon:LucideIcon}[]>={
  student:[{url:'/student',label:'My attendance',Icon:GraduationCap},{url:'/checkin',label:'Check in',Icon:ClipboardCheck}],
  instructor:[{url:'/instructor',label:'My classes',Icon:BookOpen}],
  admin:[{url:'/admin',label:'Control center',Icon:LayoutDashboard}]
};
export function Shell({user,active,heading,subtitle,children}:{user:AppUser,active:string,heading:string,subtitle:string,children:React.ReactNode}) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><Activity size={26}/></span><span><b>EUI SMART</b><small>ATTENDANCE</small></span></Link>
      <div className="sidebar-section">WORKSPACE</div>
      <nav className="nav-group">{menus[user.role].map(({url,label,Icon})=><Link className={'nav-link '+(active===url?'selected':'')} key={url} href={url}><Icon size={19}/>{label}</Link>)}</nav>
      <div className="sidebar-gap"/>
      <div className="sidebar-help"><Database size={19}/><b>Database connected</b><span>PostgreSQL · Synthetic data</span></div>
      <LogoutButton/>
      <div className="sidebar-copyright">University project prototype · 2026</div>
    </aside>
    <div className="main-zone">
      <header className="topbar"><div className="topbar-wordmark"><span className="topbar-dot"/> EUI Smart Attendance <span className="topbar-slash">/</span> {user.role}</div><div className="topbar-right"><span className="demo-chip"><ShieldCheck size={15}/> DEMO MODE</span><span className="user-avatar">{user.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span></div></header>
      <main className="content"><div className="page-heading"><div><p className="eyebrow">{user.role.toUpperCase()} WORKSPACE</p><h1>{heading}</h1><p>{subtitle}</p></div><span className="today-pill"><Radio size={15}/> Live prototype</span></div>{children}<footer className="footer">EUI Smart Attendance — proof-of-concept only. All sample records are synthetic. Not an official EUI service.</footer></main>
    </div>
  </div>;
}
export function Stat({label,value,note,Icon}:{label:string,value:string|number,note?:string,Icon:LucideIcon}) {return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19}/></span></div><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
export function SectionHeader({title,note,aside}:{title:string,note?:string,aside?:React.ReactNode}) {return <div className="section-head"><div><h2>{title}</h2>{note&&<p>{note}</p>}</div>{aside}</div>}
export function StateBadge({value}:{value:string}) {const text=value.replace(/_/g,' ');return <span className={'state-badge state-'+value.toLowerCase()}>{text}</span>}
export function displayDate(date:Date|string|null|undefined) {return date?new Date(date).toLocaleString('en-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}):'—';}
